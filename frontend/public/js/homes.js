let favouritesCache = [];

function readFavourites() {
  let favourites = [];

  try {
    const stored = localStorage.getItem('favourites');
    favourites = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(favourites)) {
      favourites = [];
    }
    favouritesCache = favourites;
  } catch (error) {
    console.warn('localStorage blocked, using memory cache', error);
    favourites = Array.isArray(favouritesCache) ? favouritesCache : [];
  }

  return favourites;
}

function writeFavourites(favourites) {
  favouritesCache = favourites;
  try {
    localStorage.setItem('favourites', JSON.stringify(favourites));
  } catch (error) {
    console.warn('localStorage blocked, falling back to memory cache', error);
  }
}

async function toggleFavourite(homeId) {
  console.log('toggleFavourite called with homeId:', homeId);

  const btn = document.getElementById(`favourite-btn-${homeId}`);
  const text = document.getElementById(`favourite-text-${homeId}`);
  const heartIcon = btn?.querySelector('i');

  if (!btn || !text) {
    console.warn('Favourite button or text element not found for home:', homeId);
    return;
  }

  btn.disabled = true;
  btn.classList.add('opacity-50');

  try {
		// Check login first
		const authRes = await fetch('/api/check-session', { credentials: 'same-origin' });
		const auth = await authRes.json();
		if (!auth.loggedIn) {
			alert('Login required!');
			window.location.href = '/login';
			return;
		}

    const favourites = readFavourites();
    const isCurrentlyFavourite = favourites.includes(homeId);
    const url = isCurrentlyFavourite ? `/favourites/delete/${homeId}` : '/favourites';

		const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
			},
			credentials: 'same-origin'
    };

    if (!isCurrentlyFavourite) {
      requestOptions.body = JSON.stringify({ homeId });
    }

		const response = await fetch(url, requestOptions);
		let data = null;
		try {
			data = await response.json();
		} catch (e) {
			console.warn('Non-JSON response from server', e);
		}

		if (response.status === 401) {
			alert('Login required!');
			window.location.href = '/login';
			return;
		}

		if (!response.ok || (data && data.success === false)) {
			const message = (data && (data.message || data.error)) || `Request failed (${response.status})`;
			console.error('Favourite request failed:', { status: response.status, data });
			showMessage(message, 'error');
			return;
		}

    if (isCurrentlyFavourite) {
      const updated = favourites.filter(id => id !== homeId);
      writeFavourites(updated);
      btn.classList.remove('bg-red-300', 'hover:bg-red-500');
      btn.classList.add('bg-green-300', 'hover:bg-green-500');
      text.textContent = 'Add to Favourite';
      if (heartIcon) {
        heartIcon.classList.remove('fas');
        heartIcon.classList.add('far');
      }
    } else {
      const updated = [...new Set([...favourites, homeId])];
      writeFavourites(updated);
      btn.classList.remove('bg-green-300', 'hover:bg-green-500');
      btn.classList.add('bg-red-300', 'hover:bg-red-500');
      text.textContent = 'Remove from Favourites';
      if (heartIcon) {
        heartIcon.classList.remove('far');
        heartIcon.classList.add('fas');
      }
    }

    const successMessage = isCurrentlyFavourite ? 'Removed from favourites' : 'Added to favourites';
    showMessage(successMessage, 'success');
  } catch (error) {
    console.error('Error while toggling favourite:', error);
    showMessage('Failed to update favourites', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50');
  }
}

function showMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
  messageDiv.textContent = message;

  document.body.appendChild(messageDiv);

  setTimeout(() => {
    if (document.body.contains(messageDiv)) {
      document.body.removeChild(messageDiv);
    }
  }, 3000);
}

window.toggleFavourite = toggleFavourite;

