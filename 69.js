// Configuration and caching
let cachedConfig = null;

// Utility function to get URL parameters
function getParameterByName(paramName, url = window.location.href) {
  const regex = new RegExp('[?&]' + paramName.replace(/[\[\]]/g, '\\$&') + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  return results ? decodeURIComponent(results[2]?.replace(/\+/g, ' ') || '') : null;
}

// Configuration fetching
async function fetchConfig(id) {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch(`https://service.cricsters.io/main?id=${id}`);
    const encryptedData = await response.text();
    const decryptedData = decryptResponse(encryptedData);
    const config = JSON.parse(decryptedData);

    if (config.error === 'ID not found') {
      window.location.href = '';
      return null;
    }

    cachedConfig = config;
    return config;
  } catch (error) {
    console.error('Error fetching configuration:', error);
    return null;
  }
}

// Decryption function for API responses
function decryptResponse(encryptedData) {
  const key = '$E*^@k];]G6STLZ3Mqh]S9R"6rm(1wPK1=QP9_uwOIn>~m[JfN/:7_Z$flq[+Hx';
  const decodedData = atob(encryptedData);
  let decrypted = '';

  for (let i = 0; i < decodedData.length; i++) {
    decrypted += String.fromCharCode(
      decodedData.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }

  return decrypted;
}

// Extract authentication token from URL
function extractTokenFromLink(url) {
  const matches = url.match(/__hdnea__=([^&]+)/);
  return matches ? matches[1] : '';
}

// Network request interception
let networkIntercepted = false;

function interceptNetworkRequests(authToken, hdneaToken) {
  if (networkIntercepted) {
    return;
  }

  networkIntercepted = true;
  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function(method, url) {
    let modifiedUrl = url;

    // URL modifications for different providers
    if (url.startsWith('https://tv.media.jio.com/')) {
      modifiedUrl = url.replace('tv.media.jio.com', 'jiotv.drmlive.au');
    } else if (url.startsWith('https://tataplaymt.slivcdn.com/')) {
      modifiedUrl = url.replace(
        'tataplaymt.slivcdn.com',
        'sony.cricsterspkl.io/sony.php'
      );
    }

    // Add authentication token for media streams
    if ((url.includes('.mpd') || url.includes('.m3u8')) && 
        hdneaToken && 
        !url.includes('__hdnea__=')) {
      modifiedUrl += (url.includes('?') ? '&' : '?') + `__hdnea__=${hdneaToken}`;
    }

    originalOpen.call(this, method, modifiedUrl);

    // Add authorization header if token exists
    if (authToken) {
      this.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }
  };
}

// Main video player initialization
async function playVideo() {
  const id = getParameterByName('id');
  if (!id) {
    console.error('No ID parameter found in the URL.');
    return;
  }

  const config = await fetchConfig(id);
  if (!config) {
    console.error('No configuration found for ID:', id);
    return;
  }

  const streamUrl = config.url;
  const bearerToken = config.Bearer;
  const hdneaToken = extractTokenFromLink(streamUrl);

  interceptNetworkRequests(bearerToken, hdneaToken);

  // JWPlayer setup
  const player = jwplayer('jwplayerDiv');
  const source = {
    file: streamUrl,
    default: true,
    type: streamUrl.endsWith('.mpd') ? 'dash' : 'hls'
  };

  const playerConfig = {
    playlist: [{
      sources: [source]
    }],
    width: '100%',
    aspectratio: '16:9',
    autostart: true
  };

  // Add DRM configuration if keys exist
  if (config.k1 && config.k2) {
    playerConfig.drm = {
      clearkey: {
        keyId: config.k1,
        key: config.k2
      }
    };
  }

  player.setup(playerConfig);
}

// Initialize player on page load
window.onload = playVideo;

});
