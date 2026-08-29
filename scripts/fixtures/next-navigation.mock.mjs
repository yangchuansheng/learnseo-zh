export function notFound() {
  const error = new Error("NEXT_NOT_FOUND");
  error.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
  throw error;
}

export function permanentRedirect(target) {
  const error = new Error("NEXT_REDIRECT");
  error.digest = `NEXT_REDIRECT;replace;${target};308;`;
  throw error;
}

export function usePathname() {
  return "/tutorials/semantic-guide/";
}
