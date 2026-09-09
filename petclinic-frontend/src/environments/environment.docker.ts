// Used only by `ng build --configuration docker` (see angular.json), which is what the
// container image builds. Inside a container the browser cannot reach the backend at
// `localhost:8080` — that name resolves on the viewer's machine, not on the compose
// network — so the API is addressed relatively and nginx proxies /api/ to backend:8080.
// A relative URL is also same-origin, which is why the container needs no CORS at all.
export const environment = {
  production: true,
  REST_API_URL: '/api/'
};
