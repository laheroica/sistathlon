import logoNegro from '../assets/logo-negro.jpg'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function mesLabel(mesKey) {
  const [y, m] = (mesKey || '').split('-').map(Number)
  return `${MESES_ES[m - 1]} ${y}`
}

// $ con puntos de miles (formato argentino). Vacío ('—') cuando es 0.
function money(n, dash = true) {
  const v = Math.round(Number(n) || 0)
  if (v === 0 && dash) return '—'
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (v < 0 ? '-$' : '$') + s
}

// Fila de 4 columnas (107 / 24 / general / total)
function fila4(label, b, { bold = false, indent = false, color = '#111827', trClass = '' } = {}) {
  const st = bold ? 'font-weight:700;' : ''
  return `
    <tr class="${trClass}">
      <td style="padding:3px 8px; ${indent ? 'padding-left:22px;' : ''} ${st}">${label}</td>
      <td style="padding:3px 8px; text-align:right; color:${color}; ${st}">${money(b['107'])}</td>
      <td style="padding:3px 8px; text-align:right; color:${color}; ${st}">${money(b['24'])}</td>
      <td style="padding:3px 8px; text-align:right; color:${color}; ${st}">${money(b.general)}</td>
      <td style="padding:3px 8px; text-align:right; font-weight:700; color:${color};">${money(b.total)}</td>
    </tr>`
}

function seccionHeader(texto, color) {
  return `<tr><td colspan="5" style="padding:10px 8px 3px; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:${color};">${texto}</td></tr>`
}

export function abrirInformePDF(mesKey, d) {
  const label = mesLabel(mesKey)
  const logoUrl = `${window.location.origin}${logoNegro}`
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const filasDisc = (d.disciplinas || []).map(x => `
    <tr>
      <td style="padding:3px 8px;">${x.nombre}</td>
      <td style="padding:3px 8px; text-align:right;">${x.cantidad}</td>
      <td style="padding:3px 8px; text-align:right; font-weight:700;">${money(x.total, false)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Informe ${label}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color:#111827; padding:16mm 14mm; font-size:12px; }
  .top { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #111827; padding-bottom:12px; margin-bottom:16px; }
  .top img { height:34px; }
  .top .t { text-align:right; }
  .top .t h1 { font-size:18px; }
  .top .t p { font-size:11px; color:#6b7280; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  thead th { font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; padding:4px 8px; border-bottom:1px solid #e5e7eb; }
  .num { text-align:right; }
  .bloque { margin-bottom:18px; }
  .zebra tbody tr:nth-child(even) { background:#f9fafb; }
  .totalrow td { border-top:2px solid #111827; padding-top:6px; }
  .resultado td { border-top:2px solid #111827; padding-top:8px; font-size:14px; font-weight:800; }
  .mini { font-size:11px; color:#374151; margin-top:4px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body>
  <div class="top">
    <img src="${logoUrl}" alt="Athlon"/>
    <div class="t"><h1>Informe mensual — ${label}</h1><p>Ingresos, egresos y resultado por sede · generado ${hoy}</p></div>
  </div>

  <!-- INGRESOS + EGRESOS + RESULTADO -->
  <table class="bloque">
    <thead><tr>
      <th style="text-align:left;">Concepto</th>
      <th class="num">A107</th><th class="num">A24</th><th class="num">General</th><th class="num">Total</th>
    </tr></thead>
    <tbody>
      ${seccionHeader('Ingresos', '#16a34a')}
      ${fila4('Cuotas cobradas', d.ingresos.cuotas, { color:'#16a34a' })}
      ${fila4('Productos', d.ingresos.productos, { color:'#16a34a' })}
      ${fila4('Total ingresos', d.ingresos.total, { bold:true, color:'#16a34a' })}

      ${seccionHeader('Egresos', '#dc2626')}
      <tr><td colspan="5" style="padding:4px 8px 0; font-size:11px; color:#6b7280;">Profes</td></tr>
      ${(d.profes||[]).map(p => fila4(p.nombre, p, { indent:true })).join('')}
      ${fila4('Subtotal profes', d.totales.profes, { bold:true })}

      <tr><td colspan="5" style="padding:6px 8px 0; font-size:11px; color:#6b7280;">Gastos fijos</td></tr>
      ${(d.fijos||[]).map(f => fila4(f.label, f, { indent:true })).join('')}
      ${fila4('Subtotal fijos', d.totales.fijos, { bold:true })}

      <tr><td colspan="5" style="padding:6px 8px 0; font-size:11px; color:#6b7280;">Gastos extras</td></tr>
      ${(d.extras||[]).map(e => {
        const b = { '107':0, '24':0, general:0, total:e.importe }; b[e.sede] = e.importe
        return fila4(e.concepto, b, { indent:true })
      }).join('')}
      ${fila4('Subtotal extras', d.totales.extras, { bold:true })}

      ${fila4('Total egresos', d.totales.egresos, { bold:true, color:'#dc2626', trClass:'totalrow' })}

      <tr class="resultado">
        <td style="padding-top:8px;">RESULTADO DEL MES</td>
        <td class="num" style="padding-top:8px; color:${d.resultado['107']>=0?'#16a34a':'#dc2626'};">${money(d.resultado['107'], false)}</td>
        <td class="num" style="padding-top:8px; color:${d.resultado['24']>=0?'#16a34a':'#dc2626'};">${money(d.resultado['24'], false)}</td>
        <td class="num" style="padding-top:8px; color:${d.resultado.general>=0?'#16a34a':'#dc2626'};">${money(d.resultado.general, false)}</td>
        <td class="num" style="padding-top:8px; color:${d.resultado.total>=0?'#16a34a':'#dc2626'};">${money(d.resultado.total, false)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ALUMNOS POR DISCIPLINA -->
  <div class="bloque">
    <table class="zebra">
      <thead><tr>
        <th style="text-align:left;">Alumnos por disciplina (${label})</th>
        <th class="num">Cantidad</th><th class="num">Total cuotas</th>
      </tr></thead>
      <tbody>${filasDisc || '<tr><td colspan="3" style="padding:6px 8px; color:#9ca3af;">Sin pagos registrados</td></tr>'}</tbody>
    </table>
    <p class="mini"><b>Ticket promedio</b> (sin Kids ni Teens): <b>${money(d.ticket.promedio, false)}</b> — calculado sobre ${d.ticket.alumnos} alumnos.</p>
  </div>

  <script>window.onload = () => window.print()<\/script>
</body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}
