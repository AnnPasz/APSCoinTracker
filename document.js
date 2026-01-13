document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'aps_coins_v1';
  const NAMES_KEY = 'aps_coin_names_v1';
  const TYPES_KEY = 'aps_coin_types_v1';

  let coins = [];
  let metalRatesUSD = { AU: null, AG: null };
  let exchangeRatesPLN = null;
  let editModeId = null;
  let currentPhotos = [];

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const fmt = (v) => (isNaN(v) ? '-' : Number(v).toFixed(2));

  const loadJSON = (k, fallback = []) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch { return fallback; } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  function loadCoins() { coins = loadJSON(STORAGE_KEY, []); return coins; }
  function saveCoins() { saveJSON(STORAGE_KEY, coins); }
  function loadNames() { return loadJSON(NAMES_KEY, []); }
  function saveNames(list) { saveJSON(NAMES_KEY, list); }
  function loadTypes() { return loadJSON(TYPES_KEY, []); }
  function saveTypes(list) { saveJSON(TYPES_KEY, list); }

  function populateDatalist() {
    const dl = $('#coinNameList'); if (!dl) return;
    dl.innerHTML = ''; loadNames().forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
  }
  
  function addName(n) {
    if (!n || typeof n !== 'string') return;
    const v = n.trim(); if (v.length < 2) return;
    const list = loadNames();
    if (!list.some(x => x.toLowerCase() === v.toLowerCase())) { list.unshift(v); saveNames(list.slice(0,200)); populateDatalist(); }
  }

  function populateTypeList() {
    const dl = $('#coinTypeList'); if (!dl) return;
    dl.innerHTML = ''; loadTypes().forEach(t => { const o = document.createElement('option'); o.value = t; dl.appendChild(o); });
  }
  
  function addType(t) {
    if (!t || typeof t !== 'string') return;
    const v = t.trim(); if (v.length < 1) return;
    const list = loadTypes();
    if (!list.some(x => x.toLowerCase() === v.toLowerCase())) { list.unshift(v); saveTypes(list.slice(0,200)); populateTypeList(); }
  }

  function genId() { return 'C' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase(); }

  function updateMetalInputs() {
    try {
      const sIn = document.getElementById('silverRate'), gIn = document.getElementById('goldRate');
      if (sIn) { if (metalRatesUSD.AG) { sIn.value = Number(metalRatesUSD.AG).toFixed(2); sIn.disabled = true; } else { sIn.disabled = false; } }
      if (gIn) { if (metalRatesUSD.AU) { gIn.value = Number(metalRatesUSD.AU).toFixed(2); gIn.disabled = true; } else { gIn.disabled = false; } }
    } catch (e) { console.warn('updateMetalInputs error', e); }
  }

  async function fetchRates() {
    const attempts = [
      async () => { const r = await fetch('https://api.metals.live/v1/spot'); return r.ok ? await r.json() : null; },
      async () => { const r = await fetch('https://data-asg.goldprice.org/dbXRates/USD'); return r.ok ? await r.json() : null; }
    ];
    
    for (const fn of attempts) {
      try {
        const data = await fn(); if (!data) continue;
        if (Array.isArray(data)) {
          for (const it of data) {
            if (!it) continue;
            if (it.metal && it.price) {
              const m = (it.metal || '').toLowerCase();
              if (m.includes('gold')) metalRatesUSD.AU = parseFloat(it.price) || metalRatesUSD.AU;
              if (m.includes('silver')) metalRatesUSD.AG = parseFloat(it.price) || metalRatesUSD.AG;
            } else {
              if (it.gold) metalRatesUSD.AU = metalRatesUSD.AU || parseFloat(it.gold);
              if (it.silver) metalRatesUSD.AG = metalRatesUSD.AG || parseFloat(it.silver);
            }
          }
        } else if (typeof data === 'object') {
          if (data.items && Array.isArray(data.items) && data.items.length) {
            const item = data.items[0];
            if (item.xauPrice) metalRatesUSD.AU = metalRatesUSD.AU || parseFloat(item.xauPrice);
            if (item.xagPrice) metalRatesUSD.AG = metalRatesUSD.AG || parseFloat(item.xagPrice);
          } else {
            if (data.gold) metalRatesUSD.AU = metalRatesUSD.AU || parseFloat(data.gold);
            if (data.silver) metalRatesUSD.AG = metalRatesUSD.AG || parseFloat(data.silver);
          }
        }
        if (metalRatesUSD.AU && metalRatesUSD.AG) break;
      } catch (err) { console.warn('metal attempt failed', err); }
    }

    let fxOk = false;
    try { const r = await fetch('https://api.exchangerate.host/latest?base=PLN'); if (r.ok) { const j = await r.json(); if (j && j.rates) { exchangeRatesPLN = j.rates; fxOk = true; } } } catch (e) { console.warn('FX fetch (base=PLN) failed', e); }
    if (!fxOk) {
      try {
        const r = await fetch('https://api.exchangerate.host/latest');
        if (r.ok) { const j = await r.json(); if (j && j.rates && j.rates.PLN) { exchangeRatesPLN = {}; Object.keys(j.rates).forEach(c => exchangeRatesPLN[c] = j.rates[c] / j.rates.PLN); fxOk = true; } }
      } catch (e) { console.warn('FX fetch (convert) failed', e); }
    }
    if (!fxOk) {
      try { const r = await fetch('https://open.er-api.com/v6/latest/PLN'); if (r.ok) { const j = await r.json(); if (j && j.rates) { exchangeRatesPLN = j.rates; fxOk = true; } } } catch (e) { console.warn('FX fetch (open.er-api) failed', e); }
    }
    updateMetalInputs();
    console.info('fetchRates result:', { metalRatesUSD, fxResolved: !!exchangeRatesPLN });
  }

  async function fetchMetalRateOnDate(metal, dateStr) {
    try {
      const r = await fetch(`https://api.metals.live/v1/history/${metal.toLowerCase()}/${dateStr}`);
      if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j.length) return parseFloat(j[0].price || j[0].value) || null; if (j && j.price) return parseFloat(j.price) || null; }
    } catch {}
    try {
      const r2 = await fetch('https://api.metals.live/v1/spot');
      if (r2.ok) {
        const arr = await r2.json();
        if (Array.isArray(arr)) { for (const it of arr) { if (it && it.metal) { const m = it.metal.toLowerCase(); if ((metal === 'AU' && m.includes('gold')) || (metal === 'AG' && m.includes('silver'))) return parseFloat(it.price) || null; } } }
      }
    } catch {}
    return null;
  }

  function convertToPLN(amount, currency) {
    if (!amount) return 0; if (!currency || currency === 'PLN') return Number(amount);
    if (exchangeRatesPLN && exchangeRatesPLN[currency]) return amount / exchangeRatesPLN[currency];
    return Number(amount);
  }
  
  function convertUSDToPLN(amountUSD) {
    if (!exchangeRatesPLN || !exchangeRatesPLN.USD) return amountUSD;
    return amountUSD / exchangeRatesPLN.USD;
  }

  function computeCurrentValuePLN(coin) {
    const mat = (coin.coinMaterial || 'Other').toUpperCase();
    if (mat === 'AU' || mat === 'AG') {
      const purity = (parseFloat(coin.coinMetalContent) || 0) / 1000;
      const weightGr = parseFloat(coin.coinWeight) || 0;
      const metalGr = weightGr * purity;
      const oz = metalGr / 31.1034768;
      let rateUSD = (mat === 'AU') ? metalRatesUSD.AU : metalRatesUSD.AG;
      if (!rateUSD) rateUSD = parseFloat((mat === 'AU' ? $('#goldRate') : $('#silverRate'))?.value) || null;
      if (rateUSD && oz > 0) {
        return convertUSDToPLN(rateUSD * oz);
      }
    }
    return convertToPLN(parseFloat(coin.purchasePrice) || 0, coin.purchaseCurrency || 'PLN');
  }

  async function computeMetalValuePLNAtDate(coin, purchaseDateStr) {
    let fxOnDate = null;
    try { const r = await fetch(`https://api.exchangerate.host/${purchaseDateStr}?base=PLN`); if (r.ok) { const j = await r.json(); fxOnDate = j.rates || null; } } catch {}
    const purchasePriceNum = parseFloat(coin.purchasePrice) || 0;
    let purchasePLN;
    if (!coin.purchaseCurrency || coin.purchaseCurrency === 'PLN') purchasePLN = purchasePriceNum;
    else if (fxOnDate && fxOnDate[coin.purchaseCurrency]) purchasePLN = purchasePriceNum / fxOnDate[coin.purchaseCurrency];
    else if (exchangeRatesPLN && exchangeRatesPLN[coin.purchaseCurrency]) purchasePLN = purchasePriceNum / exchangeRatesPLN[coin.purchaseCurrency];
    else purchasePLN = purchasePriceNum;
    let rateUSD = null;
    try { const mat = (coin.coinMaterial || 'Other').toUpperCase(); if (mat === 'AU' || mat === 'AG') rateUSD = await fetchMetalRateOnDate(mat === 'AU' ? 'AU' : 'AG', purchaseDateStr) || metalRatesUSD[mat]; } catch { rateUSD = null; }
    return { metalValuePLN: purchasePLN, rateUSD: rateUSD || null, fxRates: fxOnDate || null };
  }

  function renderCoinsTable() {
    const tbody = $('#coinsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let filtered = getFilteredAndSortedCoins();
    if (!filtered.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 13;
      td.textContent = 'No coins match your filters.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    filtered.forEach(coin => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Click to edit';
      tr.dataset.coinId = coin.coinId;
      
      const push = (v) => { const td = document.createElement('td'); td.textContent = v || '-'; tr.appendChild(td); };
      ['coinName','coinCountry','coinYear','category','type','coinMaterial','coinMetalContent','purchaseDate','purchasePrice'].forEach(k => push(coin[k]));
      push(coin.purchaseCurrency);
      push(fmt(computeCurrentValuePLN(coin)) + ' PLN');
      
      const purchasePLN = convertToPLN(parseFloat(coin.purchasePrice) || 0, coin.purchaseCurrency || 'PLN');
      const gain = computeCurrentValuePLN(coin) - purchasePLN;
      const tdGain = document.createElement('td');
      tdGain.textContent = fmt(gain) + ' PLN';
      tdGain.style.color = gain < 0 ? 'red' : (gain > 0 ? 'green' : 'inherit');
      tr.appendChild(tdGain);
      
      const tdAction = document.createElement('td');
      tdAction.style.pointerEvents = 'auto';
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'edit-btn';
      editBtn.dataset.id = coin.coinId;
      const delBtn = document.createElement('button');
      delBtn.textContent = '✖';
      delBtn.className = 'delete-btn';
      delBtn.dataset.id = coin.coinId;
      tdAction.appendChild(editBtn);
      tdAction.appendChild(delBtn);
      tr.appendChild(tdAction);
      
      tr.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        openCoinForEdit(coin.coinId);
      });
      
      tbody.appendChild(tr);
    });
  }

  function getFilteredAndSortedCoins() {
    const nameFilter = ($('#filterName')?.value || '').toLowerCase();
    const countryFilter = ($('#filterCountry')?.value || '').toLowerCase();
    const categoryFilter = $('#filterCategory')?.value || '';
    const typeFilter = ($('#filterType')?.value || '').toLowerCase();
    const materialFilter = $('#filterMaterial')?.value || '';
    const sortBy = currentSortBy;
    const sortOrder = currentSortOrder;

    let filtered = coins.filter(c => {
      if (nameFilter && !(c.coinName || '').toLowerCase().includes(nameFilter)) return false;
      if (countryFilter && !(c.coinCountry || '').toLowerCase().includes(countryFilter)) return false;
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (typeFilter && !(c.type || '').toLowerCase().includes(typeFilter)) return false;
      if (materialFilter && c.coinMaterial !== materialFilter) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'currentValue') { valA = computeCurrentValuePLN(a); valB = computeCurrentValuePLN(b); }
      else if (sortBy === 'gain') {
        const purchaseA = convertToPLN(parseFloat(a.purchasePrice) || 0, a.purchaseCurrency || 'PLN');
        const purchaseB = convertToPLN(parseFloat(b.purchasePrice) || 0, b.purchaseCurrency || 'PLN');
        valA = computeCurrentValuePLN(a) - purchaseA;
        valB = computeCurrentValuePLN(b) - purchaseB;
      } else if (sortBy === 'coinYear' || sortBy === 'purchasePrice') {
        valA = parseFloat(a[sortBy]) || 0;
        valB = parseFloat(b[sortBy]) || 0;
      } else if (sortBy === 'purchaseDate') {
        valA = new Date(a.purchaseDate || '1970-01-01').getTime();
        valB = new Date(b.purchaseDate || '1970-01-01').getTime();
      } else {
        valA = (a[sortBy] || '').toString().toLowerCase();
        valB = (b[sortBy] || '').toString().toLowerCase();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }

  function updateOverviewTotals() {
    const purchased = coins.reduce((s,c) => s + convertToPLN(parseFloat(c.purchasePrice) || 0, c.purchaseCurrency || 'PLN'), 0);
    const current = coins.reduce((s,c) => s + (computeCurrentValuePLN(c) || 0), 0);
    $('#totalPurchased').textContent = fmt(purchased) + ' PLN';
    $('#totalCurrent').textContent = fmt(current) + ' PLN';
    const gl = current - purchased;
    $('#gainLoss').textContent = fmt(gl) + ' PLN';
    $('#gainLoss').style.color = gl < 0 ? 'red' : (gl > 0 ? 'green' : 'inherit');
  }

  (function wireNav() {
    $$('.nav-link').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(a.dataset.section);
    }));
  })();

  let currentSortBy = 'coinName';
  let currentSortOrder = 'asc';
  
  document.querySelectorAll('#coinsTable th[data-sort]').forEach(th => {
    th.addEventListener('click', function() {
      const sortField = this.dataset.sort;
      if (currentSortBy === sortField) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortBy = sortField;
        currentSortOrder = 'asc';
      }
      updateSortIndicators();
      renderCoinsTable();
    });
  });
  
  function updateSortIndicators() {
    document.querySelectorAll('#coinsTable th[data-sort] .sort-indicator').forEach(span => {
      const th = span.parentElement;
      if (th.dataset.sort === currentSortBy) {
        span.textContent = currentSortOrder === 'asc' ? ' ▲' : ' ▼';
      } else {
        span.textContent = '';
      }
    });
  }

  ['filterName','filterCountry','filterCategory','filterType','filterMaterial'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => renderCoinsTable());
      if (id === 'filterName' || id === 'filterCountry' || id === 'filterType') {
        el.addEventListener('input', () => renderCoinsTable());
      }
    }
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    ['filterName','filterCountry','filterCategory','filterType','filterMaterial'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    currentSortBy = 'coinName';
    currentSortOrder = 'asc';
    updateSortIndicators();
    renderCoinsTable();
  });

  function showSection(name) {
    const sections = {
      overview: $('#overview-section'),
      'add-coin': $('#add-coin-section'),
      'all-coins': $('#all-coins-section')
    };
    Object.keys(sections).forEach(k => {
      if (sections[k]) sections[k].style.display = (k === name) ? '' : 'none';
    });
    $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === name));
    
    if (name === 'add-coin') {
      if (!editModeId) {
        const formEl = $('#coinForm');
        if (formEl) formEl.reset();
        const idEl = $('#coinId');
        if (idEl) idEl.value = genId();
        const purityEl = $('#coinMetalContent');
        if (purityEl) {
          purityEl.value = '';
          purityEl.disabled = true;
        }
      }
      $('#coinName')?.focus();
    }
    if (name === 'all-coins') {
      renderCoinsTable();
      updateOverviewTotals();
    }
    if (name === 'overview') {
      updateOverviewTotals();
    }
  }

  $('#coinMaterial')?.addEventListener('change', function () {
    const v = this.value;
    const p = $('#coinMetalContent');
    if (v === 'AG' || v === 'AU') {
      if (p) {
        p.disabled = false;
        p.required = true;
      }
    } else {
      if (p) {
        p.disabled = true;
        p.required = false;
        p.value = '';
      }
    }
  });

  const modal = $('#imageModal');
  const modalImg = $('#modalImage');
  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('thumb')) {
      const id = e.target.dataset.id;
      const found = coins.find(c => c.coinId === id);
      if (found && found.photoData) {
        if (modal) modal.style.display = 'block';
        if (modalImg) modalImg.src = found.photoData;
      }
    }
  });
  modal?.querySelector('.close')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  function openCoinForEdit(coinId) {
    const coin = coins.find(c => c.coinId === coinId);
    if (!coin) return;
    
    $('#coinId').value = coin.coinId || '';
    $('#coinName').value = coin.coinName || '';
    $('#coinCountry').value = coin.coinCountry || '';
    $('#coinYear').value = coin.coinYear || '';
    $('#coinWeight').value = coin.coinWeight || '';
    $('#coinSize').value = coin.coinSize || '';
    $('#coinCategory').value = coin.category || 'Other';
    $('#coinType').value = coin.type || '';
    $('#coinMaterial').value = coin.coinMaterial || 'Other';
    
    const purityEl = $('#coinMetalContent');
    if (purityEl) {
      if (coin.coinMaterial === 'AG' || coin.coinMaterial === 'AU') {
        purityEl.disabled = false;
        purityEl.required = true;
        purityEl.value = coin.coinMetalContent || '';
      } else {
        purityEl.disabled = true;
        purityEl.required = false;
        purityEl.value = '';
      }
    }
    $('#purchasePrice').value = coin.purchasePrice || '';
    $('#purchaseCurrency').value = coin.purchaseCurrency || 'PLN';
    $('#purchaseDate').value = coin.purchaseDate || '';
    $('#comments').value = coin.comments || '';
    
    currentPhotos = [];
    if (coin.photos && Array.isArray(coin.photos)) {
      currentPhotos = [...coin.photos];
    } else if (coin.photoData) {
      currentPhotos = [coin.photoData];
    }
    renderPhotoGallery();
    
    editModeId = coin.coinId;
    $('#submitBtn').textContent = 'Save Changes';
    $('#cancelEdit').style.display = 'inline-block';
    showSection('add-coin');
  }

  $('#coinsBody')?.addEventListener('click', (e) => {
    const edit = e.target.closest('.edit-btn');
    const del = e.target.closest('.delete-btn');
    
    if (edit) {
      e.stopPropagation();
      openCoinForEdit(edit.dataset.id);
    } else if (del) {
      e.stopPropagation();
      const coin = coins.find(c => c.coinId === del.dataset.id);
      const name = (coin && coin.coinName) || del.dataset.id;
      if (!confirm(`Delete "${name}"?`)) return;
      coins = coins.filter(c => c.coinId !== del.dataset.id);
      saveCoins();
      renderCoinsTable();
      updateOverviewTotals();
    }
  });

  $('#cancelEdit')?.addEventListener('click', () => {
    editModeId = null;
    $('#submitBtn').textContent = 'Add Coin';
    $('#cancelEdit').style.display = 'none';
    $('#coinForm')?.reset();
    currentPhotos = [];
    renderPhotoGallery();
    $('#coinId').value = '';
    const p = $('#coinMetalContent');
    if (p) p.disabled = true;
    showSection('overview');
  });

  document.getElementById('coinPhoto')?.addEventListener('change', function(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function(ev) {
        currentPhotos.push(ev.target.result);
        renderPhotoGallery();
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  });

  function renderPhotoGallery() {
    const gallery = document.getElementById('photoGallery');
    if (!gallery) return;
    
    gallery.innerHTML = '';
    currentPhotos.forEach((photoData, index) => {
      const photoContainer = document.createElement('div');
      photoContainer.style.cssText = 'position: relative; display: inline-block;';
      
      const img = document.createElement('img');
      img.src = photoData;
      img.style.cssText = 'width: 120px; height: 120px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;';
      img.title = 'Click to open full size';
      img.addEventListener('click', function() {
        const win = window.open();
        win.document.write('<html><head><title>Coin Photo</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;"><img src="' + photoData + '" style="max-width:100%;max-height:100vh;object-fit:contain;"/></body></html>');
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = '✖';
      deleteBtn.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; line-height: 1; box-shadow: 0 2px 6px rgba(0,0,0,0.3);';
      deleteBtn.title = 'Delete photo';
      deleteBtn.addEventListener('click', function() {
        if (confirm('Delete this photo?')) {
          currentPhotos.splice(index, 1);
          renderPhotoGallery();
        }
      });
      
      photoContainer.appendChild(img);
      photoContainer.appendChild(deleteBtn);
      gallery.appendChild(photoContainer);
    });
  }

  $('#coinForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nameEl = $('#coinName');
    if (nameEl) addName(nameEl.value);
    const typeEl = $('#coinType');
    if (typeEl) addType(typeEl.value);
    
    const form = {
      coinId: $('#coinId')?.value || genId(),
      coinName: $('#coinName')?.value,
      coinCountry: $('#coinCountry')?.value,
      coinYear: $('#coinYear')?.value,
      coinWeight: $('#coinWeight')?.value,
      coinSize: $('#coinSize')?.value,
      category: $('#coinCategory')?.value,
      type: $('#coinType')?.value,
      coinMaterial: $('#coinMaterial')?.value,
      coinMetalContent: $('#coinMetalContent')?.value,
      purchasePrice: $('#purchasePrice')?.value,
      purchaseCurrency: $('#purchaseCurrency')?.value,
      purchaseDate: $('#purchaseDate')?.value,
      comments: $('#comments')?.value,
      photos: []
    };
    
    const purchaseDateStr = form.purchaseDate || new Date().toISOString().slice(0,10);
    const computed = await computeMetalValuePLNAtDate(form, purchaseDateStr);
    form.metalValuePLN = Number(computed.metalValuePLN || 0);
    form.metalRateOnPurchaseUSD = computed.rateUSD || null;
    form.fxRatesOnPurchase = computed.fxRates || null;
    form.photos = [...currentPhotos];
    
    if (editModeId) {
      const idx = coins.findIndex(c => c.coinId === editModeId);
      if (idx !== -1) coins[idx] = Object.assign({}, coins[idx], form);
    } else {
      coins.push(form);
    }
    
    saveCoins();
    $('#coinForm')?.reset();
    currentPhotos = [];
    renderPhotoGallery();
    editModeId = null;
    $('#submitBtn').textContent = 'Add Coin';
    $('#cancelEdit').style.display = 'none';
    $('#coinId').value = '';
    const p = $('#coinMetalContent');
    if (p) p.disabled = true;
    showSection('all-coins');
    renderCoinsTable();
    updateOverviewTotals();
  });

  const nameInput = $('#coinName');
  if (nameInput) {
    nameInput.addEventListener('blur', (e) => addName(e.target.value));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addName(e.target.value);
    });
  }
  
  const typeInput = $('#coinType');
  if (typeInput) {
    typeInput.addEventListener('blur', (e) => addType(e.target.value));
    typeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addType(e.target.value);
    });
  }

  (async function init() {
    try {
      loadCoins();
      populateDatalist();
      populateTypeList();
      await fetchRates();
      try {
        setInterval(fetchRates, 10 * 60 * 1000);
      } catch (e) {}
      renderCoinsTable();
      const active = document.querySelector('.nav-link.active');
      if (active && active.dataset.section) showSection(active.dataset.section);
      else showSection('overview');
      updateOverviewTotals();
    } catch (err) {
      console.error('init error', err);
      const tbody = $('#coinsBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="13">Initialization error — check console.</td></tr>'; 
    }
  })();
});
