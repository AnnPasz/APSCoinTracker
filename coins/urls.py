from django.urls import path
from . import views

urlpatterns = [
    path('', views.overview, name='overview'),
    path('coins/', views.coin_list, name='coin_list'),
    path('coins/add/', views.coin_add, name='coin_add'),
    path('coins/<int:pk>/edit/', views.coin_edit, name='coin_edit'),
    path('coins/<int:pk>/delete/', views.coin_delete, name='coin_delete'),
]
