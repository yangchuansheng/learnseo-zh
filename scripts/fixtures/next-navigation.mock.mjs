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

let mockPathname = "/tutorials/semantic-guide/";

export function setMockPathname(pathname) {
  mockPathname = pathname;
}

export function usePathname() {
  return mockPathname;
}
