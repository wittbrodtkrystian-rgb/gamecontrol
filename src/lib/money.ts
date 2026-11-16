export const formatPln = (grosze: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(grosze / 100);
export const formatMb = (mb: number) => (mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`);
