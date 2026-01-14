from django.shortcuts import render, redirect, get_object_or_404
from .models import Coin
from .forms import CoinForm
from django.urls import reverse

def overview(request):
    coins = Coin.objects.all()
    total_purchased = sum([ (c.metalValuePLN if c.metalValuePLN is not None else 0) if False else (c.metalValuePLN if c.metalValuePLN else (c.purchasePrice if c.purchaseCurrency=='PLN' else c.purchasePrice)) for c in coins])
    # simpler totals: use stored metalValuePLN if present; current value computed server-side using latest spot is omitted for brevity
    total_purchased = sum([ (c.purchasePrice if c.purchaseCurrency=='PLN' else c.purchasePrice) for c in coins ])
    return render(request, 'coins/overview.html', {'coins': coins})

def coin_list(request):
    coins = Coin.objects.all().order_by('-created_at')
    return render(request, 'coins/coin_list.html', {'coins': coins})

def coin_add(request):
    if request.method == 'POST':
        form = CoinForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            return redirect('coin_list')
    else:
        form = CoinForm()
    return render(request, 'coins/coin_form.html', {'form': form, 'is_edit': False})

def coin_edit(request, pk):
    coin = get_object_or_404(Coin, pk=pk)
    if request.method == 'POST':
        form = CoinForm(request.POST, request.FILES, instance=coin)
        if form.is_valid():
            form.save()
            return redirect('coin_list')
    else:
        form = CoinForm(instance=coin)
    return render(request, 'coins/coin_form.html', {'form': form, 'is_edit': True, 'coin': coin})

def coin_delete(request, pk):
    coin = get_object_or_404(Coin, pk=pk)
    if request.method == 'POST':
        coin.delete()
        return redirect('coin_list')
    return render(request, 'coins/confirm_delete.html', {'coin': coin})
