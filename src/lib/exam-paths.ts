export function examRestrictedPath(path: string) {
  return (
    /^\/(notes|documents|projects|library|chat|extras)(\/|$)/.test(path) ||
    /^\/api\/(notifications|local-document|projects|chat(?:-attachment|-wallpaper|-room-avatar)?|extras)(\/|$)/.test(
      path,
    ) ||
    /^\/api\/v2\/(extras|chat|documents|projects)(\/|$)/.test(path)
  );
}
