from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('manual/', views.manual_control, name='manual_control'),
    path('semiauto/', views.semiauto_control, name='semiauto_control'),
    path('api/calculate/', views.calculate_path, name='calculate_path'),
    path('api/send-to-cart/', views.send_to_cart, name='send_to_cart'),
    path('api/check-esp/', views.check_esp, name='check_esp'),
    path('api/cart-status/', views.cart_status, name='cart_status'),
    path('api/manual-command/', views.manual_command, name='manual_command'),
]
