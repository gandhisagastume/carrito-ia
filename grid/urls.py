from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/calculate/', views.calculate_path, name='calculate_path'),
    path('api/send-to-cart/', views.send_to_cart, name='send_to_cart'),
    path('api/check-esp/', views.check_esp, name='check_esp'),
    path('api/cart-status/', views.cart_status, name='cart_status'),
]
