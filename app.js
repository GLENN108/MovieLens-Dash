const content = document.querySelector('#app-content');
const notice = document.querySelector('#notice');
const sidebarStatus = document.querySelector('#sidebar-status');
const sidebarDot = document.querySelector('#sidebar-status-dot');
const topbarStatus = document.querySelector('#topbar-status');
const breadcrumbPage = document.querySelector('#breadcrumb-page');

const state = {
  data: null,
  view: 'overview',
  selectedMovies: new Set(),
  selectedGenres: new Set(),
  movieSearch: '',
};

const numberFormat = new Intl.NumberFormat('en-US');
const formatNumber = (value) => numberFormat.format(value || 0);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function showNotice(message, type = 'error') {
  notice.textContent = message;
  notice.className = `notice ${type === 'success' ? 'success' : ''}`;
}

function hideNotice() {
  notice.textContent = '';
  notice.className = 'notice hidden';
}

async function requestJson(path, options) {
  const response = await fetch(path, options);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The dashboard server returned an invalid response (${response.status}).`);
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

async function checkStatus() {
  try {
    const result = await requestJson('/api/status');
    sidebarStatus.textContent = result.ready ? 'Ready to explore' : 'Data not loaded';
    sidebarDot.classList.toggle('ready', result.ready);
    topbarStatus.textContent = result.ready ? 'MovieLens 1M connected' : 'Waiting for dataset';
    document.querySelector('.live-dot').classList.toggle('ready', result.ready);
    if (result.ready) await loadDashboard();
    else renderSetup();
  } catch (error) {
    renderSetup();
    showNotice(error.message);
    sidebarStatus.textContent = 'Server unavailable';
    topbarStatus.textContent = 'Connection issue';
  }
}

async function loadDashboard() {
  content.innerHTML = '<div class="loading-state"><span class="spinner"></span><span>Crunching a million ratings…</span></div>';
  try {
    state.data = await requestJson('/api/data');
    sidebarStatus.textContent = `${formatNumber(state.data.stats.totalRatings)} ratings ready`;
    sidebarDot.classList.add('ready');
    topbarStatus.textContent = 'MovieLens 1M connected';
    document.querySelector('.live-dot').classList.add('ready');
    hideNotice();
    renderView();
  } catch (error) {
    renderSetup();
    showNotice(error.message);
  }
}

function renderSetup() {
  content.innerHTML = `
    <div class="page-heading">
      <div><div class="eyebrow">A fresh start</div><h1>Your movie data, made simple.</h1>
      <p>Explore what people love, spot the patterns, and find your next favorite.</p></div>
    </div>
    <section class="panel empty-state">
      <div class="empty-icon">✦</div>
      <h2>Let's get your dataset</h2>
      <p>MovieLens 1M contains one million ratings from thousands of movie fans. Download it here with one click, or put <code>movies.dat</code> and <code>ratings.dat</code> inside the <code>DATA</code> folder.</p>
      <button class="primary-button" id="download-button">Download MovieLens 1M <span aria-hidden="true">→</span></button>
      <p class="metric-foot" style="margin-top:12px">A small download from GroupLens. The app runs locally on your computer.</p>
    </section>`;
  document.querySelector('#download-button').addEventListener('click', downloadDataset);
}

async function downloadDataset(event) {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Downloading and unpacking…';
  hideNotice();
  try {
    await requestJson('/api/download', { method: 'POST' });
    await loadDashboard();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Try download again';
    showNotice(error.message);
  }
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  if (state.data) renderView();
}

function renderView() {
  if (!state.data) return;
  const labels = { overview: 'Overview', explore: 'Explore data', recommend: 'Recommendations' };
  breadcrumbPage.textContent = labels[state.view];
  if (state.view === 'explore') renderExplore();
  else if (state.view === 'recommend') renderRecommendations();
  else renderOverview();
}

function heading(kicker, title, description) {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>
    <div class="updated-pill"><span>●</span> MovieLens 1M dataset</div></div>`;
}

function metricCard(label, value, note, icon, color) {
  return `<article class="metric-card"><div class="metric-top">${label}<span class="metric-icon ${color}">${icon}</span></div>
    <div class="metric-value">${value}</div><div class="metric-foot">${note}</div></article>`;
}

function metricGrid() {
  const { stats } = state.data;
  return `<div class="metrics-grid">
    ${metricCard('Total ratings', formatNumber(stats.totalRatings), 'Thoughtful ratings from real people', '⌁', 'purple')}
    ${metricCard('Movies', formatNumber(stats.totalMovies), 'Across the whole collection', '▣', 'blue')}
    ${metricCard('Movie fans', formatNumber(stats.totalUsers), 'People who shared their ratings', '♙', 'orange')}
    ${metricCard('Average rating', `${Number(stats.averageRating).toFixed(2)} <span style="font-size:14px;color:#e5aa4e">★</span>`, 'Out of 5 stars', '★', 'green')}
  </div>`;
}

function panelTitle(title, subtitle, right = '') {
  return `<div class="panel-heading"><div><h2>${title}</h2><p>${subtitle}</p></div>${right}</div>`;
}

function lineChart(items, valueKey, labelKey, colorLabel = '') {
  if (!items.length) return '<div class="recommend-empty">No timeline data to display.</div>';
  const width = 600; const height = 205;
  const pad = { left: 36, right: 13, top: 12, bottom: 29 };
  const plotW = width - pad.left - pad.right; const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...items.map((item) => item[valueKey]));
  const x = (index) => pad.left + (items.length === 1 ? plotW / 2 : index * plotW / (items.length - 1));
  const y = (value) => pad.top + plotH - (value / max) * plotH;
  const points = items.map((item, index) => `${x(index)},${y(item[valueKey])}`).join(' ');
  const area = `${pad.left},${pad.top + plotH} ${points} ${pad.left + plotW},${pad.top + plotH}`;
  const yLines = [0, .5, 1].map((fraction) => {
    const py = pad.top + plotH - plotH * fraction;
    const axisValue = max * fraction;
    const label = valueKey === 'averageRating' ? axisValue.toFixed(1) : shortNumber(axisValue);
    return `<line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${py}" y2="${py}"/>
      <text class="chart-label" x="${pad.left - 7}" y="${py + 3}" text-anchor="end">${label}</text>`;
  }).join('');
  const step = Math.max(1, Math.floor(items.length / 5));
  const xLabels = items.map((item, index) => index % step === 0 || index === items.length - 1
    ? `<text class="chart-label" x="${x(index)}" y="${height - 7}" text-anchor="middle">${escapeHtml(item[labelKey])}</text>` : '').join('');
  const dots = items.length < 35 ? items.map((item, index) => `<circle class="line-point" cx="${x(index)}" cy="${y(item[valueKey])}" r="3"><title>${escapeHtml(item[labelKey])}: ${formatNumber(item[valueKey])} ${escapeHtml(colorLabel)}</title></circle>`).join('') : '';
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(colorLabel)} chart">
    <defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#7962eb" stop-opacity=".2"/><stop offset="100%" stop-color="#7962eb" stop-opacity="0"/></linearGradient></defs>
    ${yLines}<polygon class="line-fill" points="${area}"/><polyline class="line-path" points="${points}"/>${dots}${xLabels}</svg></div>`;
}

function shortNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return Math.round(value).toString();
}

function barChart(items, valueKey, labelKey) {
  const width = 440; const height = 205; const pad = { left: 28, right: 9, top: 10, bottom: 30 };
  const plotW = width - pad.left - pad.right; const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...items.map((item) => item[valueKey]));
  const gap = Math.max(4, plotW * .018); const barW = (plotW - gap * items.length) / items.length;
  const bars = items.map((item, index) => {
    const barH = Math.max(1, item[valueKey] / max * plotH);
    const bx = pad.left + index * (barW + gap); const by = pad.top + plotH - barH;
    return `<rect class="bar ${index === 7 ? 'highlight' : ''}" x="${bx}" y="${by}" width="${Math.max(2, barW)}" height="${barH}"><title>${escapeHtml(item[labelKey])}: ${formatNumber(item[valueKey])} ratings</title></rect>
      <text class="chart-label" x="${bx + barW / 2}" y="${height - 10}" text-anchor="middle">${escapeHtml(item[labelKey])}</text>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Rating distribution bar chart">
    <line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${pad.top + plotH}" y2="${pad.top + plotH}"/>${bars}</svg></div>`;
}

function genreRows(genres, valueKey = 'ratingCount', limit = 6) {
  const rows = genres.slice(0, limit); const max = Math.max(1, ...rows.map((item) => item[valueKey]));
  return rows.map((item) => `<div class="genre-row"><span class="genre-name">${escapeHtml(item.genre)}</span>
    <div class="genre-track"><div class="genre-fill" style="width:${Math.max(2, item[valueKey] / max * 100)}%"></div></div>
    <span class="genre-count">${valueKey === 'averageRating' ? Number(item[valueKey]).toFixed(2) : formatNumber(item[valueKey])}</span></div>`).join('');
}

function movieTable(movies) {
  return `<div class="table-wrap"><table><thead><tr><th>MOVIE</th><th>GENRES</th><th>RATINGS</th><th>AVERAGE</th></tr></thead><tbody>
    ${movies.map((movie) => `<tr><td class="movie-title">${escapeHtml(movie.title)}</td>
      <td><div class="genre-tags">${movie.genres.slice(0, 3).map((genre) => `<span class="genre-tag">${escapeHtml(genre)}</span>`).join('') || '<span class="genre-tag">Uncategorized</span>'}</div></td>
      <td>${formatNumber(movie.ratingCount)}</td><td class="rating-chip">${Number(movie.averageRating).toFixed(2)} ★</td></tr>`).join('')}
    </tbody></table></div>`;
}

function renderOverview() {
  const ratings = state.data.ratingsByYear;
  const topGenres = state.data.genres;
  content.innerHTML = `${heading('Your movie snapshot', 'The story in the stars.', 'A friendly little tour through a million movie ratings.')}
    ${metricGrid()}
    <div class="content-grid">
      <section class="panel">${panelTitle('Ratings over time', 'When movie fans shared their opinions')}
        ${lineChart(ratings, 'count', 'year', 'ratings')}</section>
      <section class="panel">${panelTitle('Genres people rate', 'Most-rated movie genres')}
        ${genreRows(topGenres, 'ratingCount', 7)}</section>
    </div>
    <section class="panel table-panel">${panelTitle('Most talked-about movies', 'The 10 films with the most ratings')}
      ${movieTable(state.data.topMovies)}</section>`;
}

function renderExplore() {
  const genresByRating = [...state.data.genres].sort((a, b) => b.averageRating - a.averageRating);
  const yearRows = state.data.ratingsByReleaseYear;
  const decades = state.data.ratingsByDecade;
  content.innerHTML = `${heading('Take a closer look', 'Curious? Start here.', 'A few patterns hidden in the ratings, made easy to explore.')}
    ${metricGrid()}
    <div class="content-grid">
      <section class="panel">${panelTitle('Rating distribution', 'How many people gave each star rating')}
        ${barChart(state.data.ratingDistribution, 'count', 'rating')}</section>
      <section class="panel">${panelTitle('Genre ratings', 'Average rating by genre, sorted highest first')}
        ${genreRows(genresByRating, 'averageRating', 8)}
        <div class="metric-foot">Each genre average uses every rating for movies in that genre.</div></section>
    </div>
    <div class="content-grid">
      <section class="panel">${panelTitle('Rating activity over time', 'The year each rating was submitted')}
        ${lineChart(state.data.ratingsByYear, 'count', 'year', 'ratings')}</section>
      <section class="panel">${panelTitle('By release decade', 'Average rating for movies from each decade')}
        <div class="decade-grid">${decades.map((item) => `<div class="decade-card"><strong>${item.decade}s <b>${item.averageRating.toFixed(2)} ★</b></strong>
          <span>${formatNumber(item.ratingCount)} ratings</span></div>`).join('')}</div>
      </section>
    </div>
    <section class="panel">${panelTitle('Movies by release year', 'Average audience rating for each movie release year')}
      ${lineChart(yearRows, 'averageRating', 'year', 'average rating')}</section>`;
}

function selectedMovies() {
  const selected = state.data.movies.filter((movie) => state.selectedMovies.has(movie.id));
  return selected.slice(0, 5);
}

function recommendationResults() {
  const chosenMovies = selectedMovies();
  const chosenGenres = new Set(state.selectedGenres);
  if (!chosenMovies.length && !chosenGenres.size) return [];

  const genreCounts = new Map();
  state.data.genres.forEach((item) => genreCounts.set(item.genre, item.movieCount));
  const totalMovies = Math.max(state.data.movies.length, 1);
  const idf = (genre) => Math.log(1 + totalMovies / (1 + (genreCounts.get(genre) || 0)));
  const profile = new Map();
  chosenMovies.forEach((movie) => {
    const weight = 1 / chosenMovies.length;
    movie.genres.forEach((genre) => profile.set(genre, (profile.get(genre) || 0) + weight * idf(genre)));
  });
  chosenGenres.forEach((genre) => profile.set(genre, (profile.get(genre) || 0) + idf(genre)));
  const profileNorm = Math.sqrt([...profile.values()].reduce((sum, value) => sum + value * value, 0)) || 1;
  const excluded = new Set(chosenMovies.map((movie) => movie.id));

  return state.data.movies.filter((movie) => movie.genres.length && !excluded.has(movie.id))
    .map((movie) => {
      let dot = 0; let movieNorm = 0;
      movie.genres.forEach((genre) => {
        const weight = idf(genre);
        dot += weight * (profile.get(genre) || 0);
        movieNorm += weight * weight;
      });
      const similarity = dot / (profileNorm * Math.sqrt(movieNorm || 1));
      const confidence = movie.ratingCount ? Math.min(1, Math.log1p(movie.ratingCount) / 7) : 0;
      const quality = movie.averageRating / 5;
      return { movie, score: similarity * .82 + quality * confidence * .18 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.movie.ratingCount - a.movie.ratingCount)
    .slice(0, 12);
}

function renderRecommendations() {
  const allGenres = state.data.genres.map((item) => item.genre).sort((a, b) => a.localeCompare(b));
  const matches = state.data.movies.filter((movie) => movie.title.toLowerCase().includes(state.movieSearch.toLowerCase())).slice(0, 8);
  const results = recommendationResults();
  content.innerHTML = `${heading('Made for your taste', 'A little more your kind of movie.', 'Pick a few favorites or genres. We’ll find films with a similar feel.')}
    <div class="recommend-layout">
      <section class="panel">
        <div class="control-section">
          <div class="control-title">Movies you like</div>
          <p class="control-help">Search and choose up to five films to use as inspiration.</p>
          <input class="search-input" id="movie-search" type="search" placeholder="Try “Toy Story” or “Matrix”" value="${escapeHtml(state.movieSearch)}" autocomplete="off">
          <div class="movie-picker" id="movie-picker">${matches.map((movie) => {
            const selected = state.selectedMovies.has(movie.id);
            return `<button class="movie-option ${selected ? 'selected' : ''}" data-movie-id="${movie.id}">
              <span>${escapeHtml(movie.title)}</span><small>${selected ? '✓ Added' : movie.year || 'Movie'}</small></button>`;
          }).join('') || '<div class="recommend-empty">No movie found. Try another title.</div>'}</div>
          <div class="selected-list">${selectedMovies().map((movie) => `<span class="selected-chip">${escapeHtml(movie.title)}
            <button class="remove-chip" data-remove-movie="${movie.id}" aria-label="Remove ${escapeHtml(movie.title)}">×</button></span>`).join('')}</div>
        </div>
        <div class="control-section">
          <div class="control-title">Genres you’re in the mood for</div>
          <p class="control-help">Pick as many as you like — think of these as your movie tags.</p>
          <div class="genre-picker">${allGenres.map((genre) => `<button class="genre-button ${state.selectedGenres.has(genre) ? 'selected' : ''}" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`).join('')}</div>
        </div>
        <div class="control-section"><button class="secondary-button" id="clear-preferences">Clear my picks</button></div>
      </section>
      <section class="panel">
        ${panelTitle('Your movie matches', 'Recommendations based on shared genres and audience ratings')}
        <div id="recommendation-list">${results.length ? results.map(({ movie, score }) => `<article class="rec-card">
          <div class="poster-placeholder" aria-hidden="true">${escapeHtml(movie.title.charAt(0))}</div>
          <div><h3 class="rec-title">${escapeHtml(movie.title)}</h3><div class="rec-meta">${movie.year || 'Release year unknown'} · ${movie.genres.slice(0, 3).map(escapeHtml).join(' · ')} · ${Number(movie.averageRating).toFixed(1)} ★</div></div>
          <div class="match-score">${Math.round(score * 100)}% match</div></article>`).join('') : '<div class="recommend-empty">Choose a movie you like or a genre above, and your recommendations will appear here.</div>'}</div>
      </section>
    </div>`;

  const search = document.querySelector('#movie-search');
  search.addEventListener('input', (event) => {
    state.movieSearch = event.target.value;
    updateMoviePicker();
  });
  document.querySelector('#movie-picker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-movie-id]');
    if (!button) return;
    const id = Number(button.dataset.movieId);
    if (state.selectedMovies.has(id)) state.selectedMovies.delete(id);
    else if (state.selectedMovies.size < 5) state.selectedMovies.add(id);
    else showNotice('You can pick up to five favorite movies.');
    renderRecommendations();
  });
  document.querySelector('.selected-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-movie]');
    if (!button) return;
    state.selectedMovies.delete(Number(button.dataset.removeMovie));
    renderRecommendations();
  });
  document.querySelector('.genre-picker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-genre]');
    if (!button) return;
    const genre = button.dataset.genre;
    if (state.selectedGenres.has(genre)) state.selectedGenres.delete(genre);
    else state.selectedGenres.add(genre);
    renderRecommendations();
  });
  document.querySelector('#clear-preferences').addEventListener('click', () => {
    state.selectedMovies.clear();
    state.selectedGenres.clear();
    state.movieSearch = '';
    hideNotice();
    renderRecommendations();
  });
}

function updateMoviePicker() {
  const picker = document.querySelector('#movie-picker');
  if (!picker) return;
  const matches = state.data.movies.filter((movie) => movie.title.toLowerCase().includes(state.movieSearch.toLowerCase())).slice(0, 8);
  picker.innerHTML = matches.map((movie) => {
    const selected = state.selectedMovies.has(movie.id);
    return `<button class="movie-option ${selected ? 'selected' : ''}" data-movie-id="${movie.id}">
      <span>${escapeHtml(movie.title)}</span><small>${selected ? '✓ Added' : movie.year || 'Movie'}</small></button>`;
  }).join('') || '<div class="recommend-empty">No movie found. Try another title.</div>';
}

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

checkStatus();
