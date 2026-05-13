from django.shortcuts import render
from django.http import JsonResponse
import json
from . import astar

def index(request):
    return render(request, 'grid/index.html')

def calculate_path(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # data: {size, start, goal, initial_orientation, obstacles, cell_costs}
            result = astar.calculate_astar(data)
            return JsonResponse(result)
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)})
    return JsonResponse({"error": "Only POST method is allowed"}, status=405)

import requests

def send_to_cart(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            esp_ip = data.get('esp_ip')
            instructions = data.get('instructions', [])
            
            if not esp_ip:
                return JsonResponse({"success": False, "error": "Falta la IP del ESP"})
                
            esp_url = f"http://{esp_ip}/execute"
            
            # Mandar el POST real al ESP8266
            response = requests.post(esp_url, json={"instructions": instructions}, timeout=5)
            
            if response.status_code == 200:
                return JsonResponse({"success": True, "message": "Enviado al carrito exitosamente"})
            else:
                return JsonResponse({"success": False, "error": f"Error del ESP: HTTP {response.status_code}"})
                
        except requests.exceptions.RequestException as e:
            return JsonResponse({"success": False, "error": f"No se pudo conectar al carrito en {esp_ip}"})
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)})
            
    return JsonResponse({"error": "Only POST method is allowed"}, status=405)

def check_esp(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            esp_ip = data.get('esp_ip')
            if not esp_ip:
                return JsonResponse({"success": False, "error": "Falta la IP"})
            
            esp_url = f"http://{esp_ip}/ping"
            response = requests.get(esp_url, timeout=3)
            
            if response.status_code == 200:
                return JsonResponse({"success": True})
            else:
                return JsonResponse({"success": False, "error": "Respuesta inválida"})
                
        except requests.exceptions.RequestException:
            return JsonResponse({"success": False, "error": "Timeout / No reachable"})
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)})
    return JsonResponse({"error": "Only POST method is allowed"}, status=405)

def cart_status(request):
    if request.method == 'GET':
        return JsonResponse({"status": "idle", "step": 0})
    return JsonResponse({"error": "Only GET method is allowed"}, status=405)

def manual_control(request):
    return render(request, 'grid/manual.html')

def semiauto_control(request):
    return render(request, 'grid/semiauto.html')

def manual_command(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            esp_ip = data.get('esp_ip')
            action = data.get('action')

            if not esp_ip:
                return JsonResponse({"success": False, "error": "Falta la IP del ESP"})
            if not action:
                return JsonResponse({"success": False, "error": "Falta la accion"})

            # Validar acciones permitidas
            valid_actions = ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'STOP']
            if action not in valid_actions:
                return JsonResponse({"success": False, "error": f"Accion invalida: {action}"})

            esp_url = f"http://{esp_ip}/manual"
            response = requests.post(esp_url, json={"action": action}, timeout=5)

            if response.status_code == 200:
                return JsonResponse({"success": True, "message": "Comando enviado al carrito"})
            else:
                return JsonResponse({"success": False, "error": f"Error del ESP: HTTP {response.status_code}"})

        except requests.exceptions.RequestException as e:
            return JsonResponse({"success": False, "error": f"No se pudo conectar al carrito en {esp_ip}"})
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)})

    return JsonResponse({"error": "Only POST method is allowed"}, status=405)
