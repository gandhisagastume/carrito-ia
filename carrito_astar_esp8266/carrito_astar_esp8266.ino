/*
 * ============================================================
 *  CARRITO AUTÓNOMO A* — Código ESP8266  (v2 - Debug Mode)
 * ============================================================
 *  Board:  NodeMCU 1.0 (ESP-12E Module)
 *  Libs:   ESP8266WiFi, ESP8266WebServer, ArduinoJson 6.x, Wire
 * ============================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <Wire.h>

// ============================================================
//  CONFIGURACIÓN
// ============================================================
const char* WIFI_SSID     = "porsche 911";
const char* WIFI_PASSWORD = "soria123";

// ============================================================
//  PINES — L298N
// ============================================================
#define MOTOR_IZQ_FWD  14   // D5 → IN1
#define MOTOR_IZQ_BCK  12   // D6 → IN2
#define MOTOR_DER_FWD  13   // D7 → IN3
#define MOTOR_DER_BCK  15   // D8 → IN4

// ============================================================
//  PINES — MPU-9250
// ============================================================
#define MPU_SDA  4
#define MPU_SCL  5
#define MPU_ADDR 0x68

// ============================================================
//  CALIBRACIÓN
// ============================================================
const float VELOCIDAD_CM_S  = 14.0;    // cm/s — calibrar midiendo en el suelo
const int   MARGEN_GIRO_MS  = 80;
const float UMBRAL_GIRO_DEG = 85.0;
const float GYRO_SENSITIVITY = 131.0;

// ============================================================
//  ESTADO GLOBAL
// ============================================================
ESP8266WebServer server(80);

// Guardamos accion como char[16] para evitar problemas de String+JsonDocument scope
struct Instruccion {
    char  accion[16];
    float distancia_cm;
    int   grados;
};

Instruccion instrucciones[50];
int  totalInstrucciones = 0;
int  pasoActual         = 0;
bool ejecutando         = false;
bool terminado          = false;
bool mpuDisponible      = false;

float gyroZ_offset    = 0;
unsigned long tiempoAnterior = 0;
float anguloAcumulado = 0;

// ============================================================
//  UTILIDAD DE LOG
// ============================================================
void LOG(const char* msg) {
    Serial.println(msg);
}
void LOGf(const char* label, float val) {
    Serial.print(label);
    Serial.println(val);
}
void LOGi(const char* label, int val) {
    Serial.print(label);
    Serial.println(val);
}
void LOGs(const char* label, const char* val) {
    Serial.print(label);
    Serial.println(val);
}

// ============================================================
//  MOTORES
// ============================================================
void motoresStop() {
    digitalWrite(MOTOR_IZQ_FWD, LOW);
    digitalWrite(MOTOR_IZQ_BCK, LOW);
    digitalWrite(MOTOR_DER_FWD, LOW);
    digitalWrite(MOTOR_DER_BCK, LOW);
    LOG("[MOTOR] STOP — todos los pines en LOW");
}

void avanzar() {
    digitalWrite(MOTOR_IZQ_FWD, HIGH);
    digitalWrite(MOTOR_IZQ_BCK, LOW);
    digitalWrite(MOTOR_DER_FWD, HIGH);
    digitalWrite(MOTOR_DER_BCK, LOW);
    LOG("[MOTOR] AVANZAR — IZQ_FWD=HIGH, DER_FWD=HIGH");
}

void girarDerecha() {
    digitalWrite(MOTOR_IZQ_FWD, HIGH);
    digitalWrite(MOTOR_IZQ_BCK, LOW);
    digitalWrite(MOTOR_DER_FWD, LOW);
    digitalWrite(MOTOR_DER_BCK, LOW);
    LOG("[MOTOR] GIRO DERECHA — IZQ_FWD=HIGH, DER=OFF");
}

void girarIzquierda() {
    digitalWrite(MOTOR_IZQ_FWD, LOW);
    digitalWrite(MOTOR_IZQ_BCK, LOW);
    digitalWrite(MOTOR_DER_FWD, HIGH);
    digitalWrite(MOTOR_DER_BCK, LOW);
    LOG("[MOTOR] GIRO IZQUIERDA — IZQ=OFF, DER_FWD=HIGH");
}

// ============================================================
//  MPU-9250
// ============================================================
void mpuWrite(uint8_t reg, uint8_t valor) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(reg);
    Wire.write(valor);
    uint8_t err = Wire.endTransmission();
    if (err != 0) {
        Serial.print("[MPU] ERROR escribiendo reg 0x");
        Serial.print(reg, HEX);
        Serial.print(" → err=");
        Serial.println(err);
    }
}

int16_t mpuReadInt16(uint8_t reg) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    uint8_t received = Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)2);
    if (received < 2) {
        return 0; // Error silencioso de lectura
    }
    int16_t val = (Wire.read() << 8) | Wire.read();
    return val;
}

bool mpuInit() {
    Wire.begin(MPU_SDA, MPU_SCL);
    delay(200);

    // Verificar si el MPU responde (WHO_AM_I = 0x75)
    Wire.beginTransmission(MPU_ADDR);
    uint8_t err = Wire.endTransmission();
    if (err != 0) {
        Serial.print("[MPU] No se detectó dispositivo en 0x68 → Error I2C: ");
        Serial.println(err);
        LOG("[MPU] *** EL GIROSCOPIO NO ESTÁ CONECTADO O TIENE DIRECCIÓN INCORRECTA ***");
        LOG("[MPU] Los giros usarán TIEMPO FIJO en lugar del giroscopio.");
        return false;
    }

    // Despertar MPU
    mpuWrite(0x6B, 0x00);
    delay(100);
    // Rango giroscopio ±250 deg/s
    mpuWrite(0x1B, 0x00);
    delay(10);

    // Leer WHO_AM_I
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x75);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)1);
    uint8_t whoami = Wire.read();
    Serial.print("[MPU] WHO_AM_I = 0x");
    Serial.println(whoami, HEX); // Debe ser 0x71 (MPU-9250) o 0x70 (MPU-6500)

    LOG("[MPU] Inicializado correctamente.");
    return true;
}

void calibrarGiroscopio() {
    if (!mpuDisponible) {
        LOG("[MPU] Saltando calibración — MPU no disponible.");
        return;
    }
    LOG("[MPU] Calibrando giroscopio (2 seg) — NO MUEVAS EL CARRITO...");
    float suma = 0;
    int muestras = 200;
    for (int i = 0; i < muestras; i++) {
        suma += (float)mpuReadInt16(0x47);
        delay(10);
    }
    gyroZ_offset = suma / muestras;
    LOGf("[MPU] Offset Z calibrado: ", gyroZ_offset);
}

float leerGyroZ() {
    int16_t raw = mpuReadInt16(0x47);
    return ((float)raw - gyroZ_offset) / GYRO_SENSITIVITY;
}

// ============================================================
//  EJECUCIÓN
// ============================================================
void ejecutarAvanzar(float distancia_cm) {
    if (distancia_cm <= 0) {
        LOG("[EXEC] distancia_cm es 0 o negativa — ignorando FORWARD");
        return;
    }
    unsigned long tiempoMs = (unsigned long)((distancia_cm / VELOCIDAD_CM_S) * 1000.0);
    Serial.print("[EXEC] AVANZAR: ");
    Serial.print(distancia_cm);
    Serial.print(" cm → tiempo estimado: ");
    Serial.print(tiempoMs);
    Serial.println(" ms");

    avanzar();
    unsigned long inicio = millis();
    while (millis() - inicio < tiempoMs) {
        yield(); // Mantener WiFi vivo durante avance
    }
    motoresStop();
    delay(300);
}

void ejecutarGiroConTiempo(bool esDerecha) {
    // Fallback: usa tiempo fijo de ~700ms para ~90° (ajustar según velocidad de giro)
    const unsigned long TIEMPO_GIRO_MS = 700;
    LOG("[EXEC] GIRO con tiempo fijo (sin giroscopio)");

    if (esDerecha) girarDerecha();
    else           girarIzquierda();

    unsigned long inicio = millis();
    while (millis() - inicio < TIEMPO_GIRO_MS) {
        yield();
    }
    delay(MARGEN_GIRO_MS);
    motoresStop();
    delay(400);
}

void ejecutarGiroConGiroscopio(bool esDerecha) {
    anguloAcumulado = 0;
    tiempoAnterior  = millis();
    unsigned long inicioGiro = millis();

    if (esDerecha) girarDerecha();
    else           girarIzquierda();

    LOG("[EXEC] GIRO con giroscopio — integrando...");
    while (abs(anguloAcumulado) < UMBRAL_GIRO_DEG) {
        unsigned long ahora = millis();
        float dt = (ahora - tiempoAnterior) / 1000.0;
        tiempoAnterior = ahora;

        float gz = leerGyroZ();
        if (esDerecha) anguloAcumulado += gz * dt;
        else           anguloAcumulado -= gz * dt;

        if (ahora - inicioGiro > 2500) {
            LOG("[EXEC] TIMEOUT DE GIRO — cambiar a modo tiempo fijo o revisar MPU");
            break;
        }
        server.handleClient();
        yield();
        delay(5);
    }
    delay(MARGEN_GIRO_MS);
    motoresStop();
    delay(400);
    LOGf("[EXEC] Angulo final alcanzado: ", anguloAcumulado);
}

void ejecutarGiro(bool esDerecha) {
    Serial.print("[EXEC] GIRO ");
    Serial.println(esDerecha ? "DERECHA" : "IZQUIERDA");

    if (mpuDisponible) {
        ejecutarGiroConGiroscopio(esDerecha);
    } else {
        ejecutarGiroConTiempo(esDerecha);
    }
}

void ejecutarSiguientePaso() {
    if (pasoActual >= totalInstrucciones) {
        motoresStop();
        ejecutando = false;
        terminado  = true;
        LOG("[EXEC] === RUTA COMPLETADA ===");
        return;
    }

    Instruccion& inst = instrucciones[pasoActual];
    Serial.print("[EXEC] Paso ");
    Serial.print(pasoActual + 1);
    Serial.print("/");
    Serial.print(totalInstrucciones);
    Serial.print(" → accion='");
    Serial.print(inst.accion);
    Serial.print("'  dist=");
    Serial.print(inst.distancia_cm);
    Serial.print("  grados=");
    Serial.println(inst.grados);

    if (strcmp(inst.accion, "FORWARD") == 0) {
        ejecutarAvanzar(inst.distancia_cm);
    } else if (strcmp(inst.accion, "TURN_RIGHT") == 0) {
        ejecutarGiro(true);
    } else if (strcmp(inst.accion, "TURN_LEFT") == 0) {
        ejecutarGiro(false);
    } else if (strcmp(inst.accion, "STOP") == 0) {
        motoresStop();
        ejecutando = false;
        terminado  = true;
        LOG("[EXEC] STOP — Ruta finalizada.");
        return;
    } else {
        Serial.print("[EXEC] ACCION DESCONOCIDA: '");
        Serial.print(inst.accion);
        Serial.println("' — saltando");
    }

    pasoActual++;
}

// ============================================================
//  ENDPOINTS HTTP
// ============================================================
void handlePing() {
    LOG("[HTTP] GET /ping");
    server.send(200, "application/json",
        "{\"status\":\"ok\",\"device\":\"carrito-astar\",\"executing\":" +
        String(ejecutando ? "true" : "false") + "}");
}

void handleExecute() {
    LOG("[HTTP] POST /execute recibido");
    if (server.method() != HTTP_POST) {
        server.send(405, "application/json", "{\"error\":\"Solo POST\"}");
        return;
    }

    String body = server.arg("plain");
    Serial.print("[HTTP] Body length: ");
    Serial.println(body.length());
    Serial.print("[HTTP] Body: ");
    Serial.println(body.substring(0, 300)); // Primeros 300 chars para no saturar

    // ArduinoJson v6
    StaticJsonDocument<4096> doc;
    DeserializationError error = deserializeJson(doc, body);
    if (error) {
        Serial.print("[HTTP] ERROR JSON: ");
        Serial.println(error.c_str());
        server.send(400, "application/json", "{\"error\":\"JSON invalido\"}");
        return;
    }

    if (!doc.containsKey("instructions")) {
        LOG("[HTTP] ERROR: El JSON no tiene clave 'instructions'");
        server.send(400, "application/json", "{\"error\":\"Falta clave instructions\"}");
        return;
    }

    JsonArray arr = doc["instructions"].as<JsonArray>();
    totalInstrucciones = 0;

    LOG("[HTTP] Parseando instrucciones:");
    for (JsonObject item : arr) {
        if (totalInstrucciones >= 50) break;

        Instruccion inst;
        // Usar strncpy para copiar el String antes de que el doc salga del scope
        const char* ac = item["action"] | "UNKNOWN";
        strncpy(inst.accion, ac, sizeof(inst.accion) - 1);
        inst.accion[sizeof(inst.accion) - 1] = '\0';
        inst.distancia_cm = item["distance_cm"] | 0.0f;
        inst.grados       = item["degrees"]      | 0;

        instrucciones[totalInstrucciones] = inst;

        Serial.print("  [");
        Serial.print(totalInstrucciones);
        Serial.print("] accion='");
        Serial.print(inst.accion);
        Serial.print("'  dist=");
        Serial.print(inst.distancia_cm);
        Serial.print("  grados=");
        Serial.println(inst.grados);

        totalInstrucciones++;
    }

    LOGi("[HTTP] Total instrucciones parseadas: ", totalInstrucciones);

    if (totalInstrucciones == 0) {
        LOG("[HTTP] ADVERTENCIA: Se parsearon 0 instrucciones. Revisa el JSON.");
        server.send(400, "application/json", "{\"error\":\"Lista de instrucciones vacía\"}");
        return;
    }

    // Activar ejecución
    pasoActual  = 0;
    ejecutando  = true;
    terminado   = false;

    String resp = "{\"status\":\"executing\",\"total_steps\":" + String(totalInstrucciones) + "}";
    server.send(200, "application/json", resp);
    LOG("[HTTP] Respuesta enviada — comenzando ejecución...");
}

void handleStatus() {
    String json = "{";
    json += "\"executing\":"  + String(ejecutando ? "true" : "false") + ",";
    json += "\"done\":"       + String(terminado  ? "true" : "false") + ",";
    json += "\"step\":"       + String(pasoActual) + ",";
    json += "\"total\":"      + String(totalInstrucciones) + ",";
    json += "\"mpu_ok\":"     + String(mpuDisponible ? "true" : "false");
    json += "}";
    server.send(200, "application/json", json);
}

void handleDebug() {
    String json = "{";
    json += "\"ejecutando\":"    + String(ejecutando ? "true" : "false") + ",";
    json += "\"terminado\":"     + String(terminado  ? "true" : "false") + ",";
    json += "\"pasoActual\":"    + String(pasoActual) + ",";
    json += "\"total\":"         + String(totalInstrucciones) + ",";
    json += "\"mpu_ok\":"        + String(mpuDisponible ? "true" : "false") + ",";
    json += "\"pin_IZQ_FWD\":"   + String(digitalRead(MOTOR_IZQ_FWD)) + ",";
    json += "\"pin_IZQ_BCK\":"   + String(digitalRead(MOTOR_IZQ_BCK)) + ",";
    json += "\"pin_DER_FWD\":"   + String(digitalRead(MOTOR_DER_FWD)) + ",";
    json += "\"pin_DER_BCK\":"   + String(digitalRead(MOTOR_DER_BCK));
    json += "}";
    server.send(200, "application/json", json);
    LOG("[HTTP] GET /debug respondido");
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(500);
    LOG("\n\n========== CARRITO A* v2 ==========");

    // Pines motor
    pinMode(MOTOR_IZQ_FWD, OUTPUT);
    pinMode(MOTOR_IZQ_BCK, OUTPUT);
    pinMode(MOTOR_DER_FWD, OUTPUT);
    pinMode(MOTOR_DER_BCK, OUTPUT);
    motoresStop();
    LOG("[SETUP] Pines de motor configurados como OUTPUT.");

    // TEST RÁPIDO DE MOTORES (500ms) — COMENTA SI NO LO NECESITAS
    LOG("[SETUP] TEST: Avanzando 500ms para verificar motores...");
    avanzar();
    delay(500);
    motoresStop();
    LOG("[SETUP] TEST: Motores ok si se movieron.");

    // MPU
    mpuDisponible = mpuInit();
    calibrarGiroscopio();

    // WiFi AP
    Serial.print("[SETUP] Levantando AP: ");
    Serial.println(WIFI_SSID);
    bool ok = WiFi.softAP(WIFI_SSID, WIFI_PASSWORD);
    if (ok) {
        Serial.print("[SETUP] AP activo. IP: ");
        Serial.println(WiFi.softAPIP());
    } else {
        LOG("[SETUP] ERROR al levantar el AP.");
    }

    // Rutas HTTP
    server.on("/ping",    HTTP_GET,  handlePing);
    server.on("/execute", HTTP_POST, handleExecute);
    server.on("/status",  HTTP_GET,  handleStatus);
    server.on("/debug",   HTTP_GET,  handleDebug);
    server.begin();
    LOG("[SETUP] Servidor HTTP listo en puerto 80.");
    LOG("[SETUP] ===================================\n");
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
    server.handleClient();

    if (ejecutando && !terminado) {
        ejecutarSiguientePaso();
    }

    yield();
}
