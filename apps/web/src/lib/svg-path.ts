/** Gera um path SVG suavizado (curvas de Bézier) a partir de uma série de
 * valores — usado nos gráficos de área/linha do dashboard (patrimônio,
 * carteira, projeção de saldo). `close` fecha o path no eixo X para uso
 * como área preenchida; sem isso, é só a linha. */
export function buildSmoothPath(values: number[], width: number, height: number, close = false): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `M0 ${y.toFixed(1)} L${width} ${y.toFixed(1)}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => [
    i * (width / (values.length - 1)),
    height - 12 - ((v - min) / range) * (height - 28),
  ]);

  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  if (close) d += ` L${width} ${height} L0 ${height} Z`;
  return d;
}
