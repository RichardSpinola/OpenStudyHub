export function examRestrictedPath(path: string) {
  return (
    /^\/today\/tasks(?:\/|$)/.test(path) ||
    /^\/api\/calendar\/export(?:\/|$)/.test(path) ||
    /^\/(notes|documents|projects|library|chat|extras)(\/|$)/.test(path) ||
    /^\/api\/(notifications|local-document|projects|chat(?:-attachment|-wallpaper|-room-avatar)?|extras)(\/|$)/.test(
      path,
    ) ||
    /^\/api\/v2\/(extras|chat|documents|projects)(\/|$)/.test(path)
  );
}
