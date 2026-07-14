import logoNegroAsset from '../assets/logo-negro.jpg'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Paleta del informe (celeste = color de marca del logo)
const CO = {
  ink:   '#0f172a',
  body:  '#334155',
  muted: '#64748b',
  line:  '#e5e9f0',
  soft:  '#f7f9fc',
  brand: '#17a6dd',
  green: '#15a34a',
  red:   '#e0413a',
  amber: '#e08a1e',
}

// Colores por disciplina para las barras
const DISC_CO = {
  CF: '#4f7bf0', HF: '#15a34a', HX: '#e0a01e', FB: '#f2793a',
  TN: '#9b6ef0', KD: '#e05aa6', BP: '#17b3a6',
}

function mesLabel(mesKey) {
  const [y, m] = (mesKey || '').split('-').map(Number)
  return `${MESES_ES[m - 1]} ${y}`
}

// $ con puntos de miles. dash=true muestra '—' cuando es 0.
function money(n, dash = true) {
  const v = Math.round(Number(n) || 0)
  if (v === 0 && dash) return '<span style="color:#cbd5e1">—</span>'
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (v < 0 ? '-$' : '$') + s
}

// Códigos de sede a mostrar en las tablas del PDF (columnas). Se setea al
// generar el informe según las sedes configuradas; default = Athlon 107/24.
let PDF_SEDES = ['107', '24']

// Fila de la tabla ingresos/egresos (una columna por sede + General + Total)
function fila4(label, b, { bold = false, indent = false, color = CO.ink, muted = false, trClass = '' } = {}) {
  const w = bold ? '700' : '400'
  const lblColor = muted ? CO.muted : CO.ink
  const td = (v, weight) => `<td style="padding:5px 10px;text-align:right;font-weight:${weight};color:${color};">${money(v || 0)}</td>`
  const cols = PDF_SEDES.map(c => td(b[c], w)).join('')
  return `
    <tr class="${trClass}">
      <td style="padding:5px 10px;${indent ? 'padding-left:24px;' : ''}font-weight:${w};color:${lblColor};">${label}</td>
      ${cols}
      ${td(b.general, w)}
      ${td(b.total, '700')}
    </tr>`
}

function grupoLabel(txt) {
  return `<tr><td colspan="${PDF_SEDES.length + 3}" style="padding:9px 10px 2px;font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${CO.muted};">${txt}</td></tr>`
}

const SEDE_LABEL = { '107': 'Athlon 107', '24': 'Athlon 24', general: 'General' }

// Segunda página: detalle de ventas de productos
function paginaVentas(d, label, logoUrl, hoy, nombre = 'Athlon', ciudad = '', sedeLabels = SEDE_LABEL) {
  const ventas = d.ventas || []
  if (ventas.length === 0) return ''
  const r = d.ventas_resumen || {}

  const filas = ventas.map((v, i) => {
    const estadoChip = v.estado === 'pendiente'
      ? `<span style="display:inline-block;padding:1px 8px;border-radius:20px;font-size:10px;font-weight:700;color:${CO.amber};background:#fdf3e3;border:1px solid #f6dfb8;">Pendiente</span>`
      : `<span style="display:inline-block;padding:1px 8px;border-radius:20px;font-size:10px;font-weight:700;color:${CO.green};background:#eafaf0;border:1px solid #c7ecd5;">Pagado</span>`
    return `
      <tr style="${i % 2 ? 'background:#fcfdfe;' : ''}">
        <td style="padding:6px 10px;color:${CO.body};">${sedeLabels[v.sede] || v.sede}</td>
        <td style="padding:6px 10px;color:${CO.body};white-space:nowrap;">${v.fecha}</td>
        <td style="padding:6px 10px;color:${CO.ink};font-weight:600;">${v.cliente}</td>
        <td style="padding:6px 10px;color:${CO.body};">${v.producto}${v.cantidad > 1 ? ` <span style="color:${CO.muted};">×${v.cantidad}</span>` : ''}</td>
        <td style="padding:6px 10px;text-align:right;color:${CO.ink};font-weight:700;">${money(v.valor, false)}</td>
        <td style="padding:6px 10px;text-align:center;">${estadoChip}</td>
      </tr>`
  }).join('')

  const th = `style="padding:7px 10px;text-align:left;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${CO.muted};border-bottom:1.5px solid ${CO.line};"`
  const thR = th.replace('text-align:left', 'text-align:right')
  const thC = th.replace('text-align:left', 'text-align:center')

  return `
  <div class="page2">
    <div class="hdr">
      <img src="${logoUrl}" alt="Athlon"/>
      <div class="r">
        <div class="t">Ventas de productos</div>
        <div class="m">${label}</div>
        <div class="d">Generado ${hoy}</div>
      </div>
    </div>
    <div class="rule"></div>

    <div class="kpis">
      ${kpiCard('Productos vendidos', String(r.unidades || 0), { accent: CO.brand, bg:'#f4f9fc', valColor: CO.ink })}
      ${kpiCard('Total vendido', money(r.total, false), { accent: CO.green, bg:'#f2fbf5', valColor: CO.green })}
      ${kpiCard('Pendiente de cobro', money(r.pendiente, false), { accent: CO.amber, bg:'#fdf7ec', valColor: CO.amber })}
    </div>

    <div class="card">
      <div class="cap"><span class="dot" style="background:${CO.brand}"></span><span class="tt">Detalle de ventas — ${label}</span></div>
      <table>
        <thead><tr>
          <th ${th}>Sucursal</th><th ${th}>Fecha</th><th ${th}>Cliente</th>
          <th ${th}>Producto</th><th ${thR}>Valor</th><th ${thC}>Estado</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>

    <div class="foot">${nombre} · Ventas de ${label} · ${r.items} venta(s)${ciudad ? ' · ' + ciudad : ''}</div>
  </div>`
}

function kpiCard(label, valor, { accent, bg, valColor }) {
  return `
    <div style="flex:1;background:${bg};border:1px solid ${CO.line};border-radius:12px;padding:14px 16px;position:relative;overflow:hidden;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${accent};"></div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:${CO.muted};margin-bottom:6px;">${label}</div>
      <div style="font-size:24px;font-weight:800;color:${valColor};line-height:1;">${valor}</div>
    </div>`
}

export function abrirInformePDF(mesKey, d, branding = {}) {
  const label = mesLabel(mesKey)
  const logoUrl = branding.logoUrl || `${window.location.origin}${logoNegroAsset}`
  const nombre  = branding.nombre || 'Athlon'
  const ciudad  = branding.ciudad || ''
  const sedeLabels = branding.sedeLabels || SEDE_LABEL
  PDF_SEDES = (branding.sedeCodes && branding.sedeCodes.length) ? branding.sedeCodes : ['107', '24']
  const colspan = PDF_SEDES.length + 3   // Concepto + sedes + General + Total
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const res = d.resultado.total
  const resColor = res >= 0 ? CO.green : CO.red

  // Barras de alumnos por disciplina
  const discs = d.disciplinas || []
  const maxTotal = Math.max(1, ...discs.map(x => x.total))
  const filasDisc = discs.map(x => {
    const col = DISC_CO[x.codigo] || CO.brand
    const w = Math.max(4, Math.round(x.total / maxTotal * 100))
    return `
      <tr>
        <td style="padding:6px 10px;white-space:nowrap;color:${CO.ink};font-weight:600;">${x.nombre}</td>
        <td style="padding:6px 10px;width:52%;">
          <div style="background:#eef2f7;border-radius:6px;height:14px;overflow:hidden;">
            <div style="width:${w}%;height:100%;background:${col};border-radius:6px;"></div>
          </div>
        </td>
        <td style="padding:6px 10px;text-align:center;color:${CO.body};font-weight:700;">${x.cantidad}</td>
        <td style="padding:6px 10px;text-align:right;color:${CO.ink};font-weight:700;">${money(x.total, false)}</td>
      </tr>`
  }).join('')

  const thNum = `style="padding:6px 10px;text-align:right;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${CO.muted};border-bottom:1.5px solid ${CO.line};"`
  const thSedes = PDF_SEDES.map(c => `<th ${thNum}>${sedeLabels[c] || c}</th>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Informe ${label}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:${CO.body};
         font-size:12px; padding:14mm 13mm; -webkit-font-smoothing:antialiased; }
  .hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .hdr img { height:38px; }
  .hdr .r { text-align:right; }
  .hdr .r .t { font-size:19px; font-weight:800; color:${CO.ink}; letter-spacing:-.2px; }
  .hdr .r .m { font-size:13px; font-weight:700; color:${CO.brand}; margin-top:1px; }
  .hdr .r .d { font-size:10px; color:${CO.muted}; margin-top:2px; }
  .rule { height:3px; background:linear-gradient(90deg,${CO.brand},${CO.brand}00); border-radius:3px; margin:8px 0 16px; }
  .kpis { display:flex; gap:12px; margin-bottom:18px; }
  .card { border:1px solid ${CO.line}; border-radius:14px; overflow:hidden; margin-bottom:16px; }
  .card > .cap { display:flex; align-items:center; gap:8px; padding:10px 14px; background:${CO.soft};
                 border-bottom:1px solid ${CO.line}; }
  .card > .cap .dot { width:9px; height:9px; border-radius:50%; }
  .card > .cap .tt { font-size:11px; font-weight:800; letter-spacing:.5px; text-transform:uppercase; color:${CO.ink}; }
  table { width:100%; border-collapse:collapse; }
  .thead th { padding:7px 10px; font-size:9.5px; font-weight:700; letter-spacing:.5px; text-transform:uppercase;
              color:${CO.muted}; border-bottom:1.5px solid ${CO.line}; }
  .tbl tbody tr:nth-child(odd) { background:#fcfdfe; }
  .totrow td { border-top:2px solid ${CO.ink}; }
  .resstrip { display:flex; align-items:stretch; border:1px solid ${CO.line}; border-radius:14px; overflow:hidden; margin-bottom:16px; }
  .resstrip .lab { flex:0 0 auto; background:${CO.ink}; color:#fff; padding:14px 18px; display:flex; flex-direction:column; justify-content:center; }
  .resstrip .lab .k { font-size:10px; letter-spacing:.8px; text-transform:uppercase; opacity:.8; }
  .resstrip .lab .v { font-size:22px; font-weight:800; margin-top:2px; }
  .resstrip .cols { flex:1; display:flex; }
  .resstrip .cols .c { flex:1; padding:12px 14px; text-align:center; border-left:1px solid ${CO.line}; }
  .resstrip .cols .c .k { font-size:9.5px; letter-spacing:.5px; text-transform:uppercase; color:${CO.muted}; }
  .resstrip .cols .c .v { font-size:15px; font-weight:800; margin-top:3px; }
  .ticket { display:flex; align-items:center; gap:14px; background:${CO.soft}; border:1px solid ${CO.line};
            border-radius:12px; padding:12px 16px; }
  .ticket .big { font-size:22px; font-weight:800; color:${CO.brand}; }
  .foot { margin-top:14px; text-align:center; font-size:9.5px; color:${CO.muted}; }
  .page2 { break-before:page; page-break-before:always; padding-top:2mm; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .card,.resstrip{ break-inside:avoid; } }
</style></head>
<body>
  <div class="hdr">
    <img src="${logoUrl}" alt="Athlon"/>
    <div class="r">
      <div class="t">Informe mensual</div>
      <div class="m">${label}</div>
      <div class="d">Generado ${hoy}</div>
    </div>
  </div>
  <div class="rule"></div>

  <!-- KPIs -->
  <div class="kpis">
    ${kpiCard('Ingresos totales', money(d.ingresos.total.total, false), { accent: CO.green, bg:'#f2fbf5', valColor: CO.green })}
    ${kpiCard('Egresos totales', money(d.totales.egresos.total, false), { accent: CO.red, bg:'#fef4f3', valColor: CO.red })}
    ${kpiCard('Resultado del mes', money(res, false), { accent: resColor, bg:'#f4f9fc', valColor: resColor })}
  </div>

  <!-- INGRESOS -->
  <div class="card">
    <div class="cap"><span class="dot" style="background:${CO.green}"></span><span class="tt">Ingresos</span></div>
    <table class="tbl">
      <thead class="thead"><tr>
        <th style="text-align:left;">Concepto</th>
        ${thSedes}<th ${thNum}>General</th><th ${thNum}>Total</th>
      </tr></thead>
      <tbody>
        ${fila4('Cuotas cobradas', d.ingresos.cuotas, { color: CO.green })}
        ${fila4('Productos', d.ingresos.productos, { color: CO.green })}
        ${fila4('Total ingresos', d.ingresos.total, { bold:true, color: CO.green, trClass:'totrow' })}
      </tbody>
    </table>
  </div>

  <!-- EGRESOS -->
  <div class="card">
    <div class="cap"><span class="dot" style="background:${CO.red}"></span><span class="tt">Egresos</span></div>
    <table class="tbl">
      <thead class="thead"><tr>
        <th style="text-align:left;">Concepto</th>
        ${thSedes}<th ${thNum}>General</th><th ${thNum}>Total</th>
      </tr></thead>
      <tbody>
        ${grupoLabel('Profes')}
        ${(d.profes||[]).map(p => fila4(p.nombre, p, { indent:true })).join('')}
        ${(d.profes||[]).length === 0 ? `<tr><td colspan="${PDF_SEDES.length + 3}" style="padding:4px 24px;color:#cbd5e1;">Sin liquidaciones confirmadas</td></tr>` : ''}
        ${fila4('Subtotal profes', d.totales.profes, { bold:true, muted:true })}

        ${grupoLabel('Gastos fijos')}
        ${(d.fijos||[]).map(f => fila4(f.label, f, { indent:true })).join('')}
        ${(d.fijos||[]).length === 0 ? `<tr><td colspan="${PDF_SEDES.length + 3}" style="padding:4px 24px;color:#cbd5e1;">Sin gastos fijos</td></tr>` : ''}
        ${fila4('Subtotal fijos', d.totales.fijos, { bold:true, muted:true })}

        ${grupoLabel('Gastos extras')}
        ${(d.extras||[]).map(e => {
          const b = { general:0, total:e.importe }; PDF_SEDES.forEach(c => { b[c] = 0 }); b[e.sede] = e.importe
          return fila4(e.concepto, b, { indent:true })
        }).join('')}
        ${(d.extras||[]).length === 0 ? `<tr><td colspan="${PDF_SEDES.length + 3}" style="padding:4px 24px;color:#cbd5e1;">Sin gastos extras</td></tr>` : ''}
        ${fila4('Subtotal extras', d.totales.extras, { bold:true, muted:true })}

        ${fila4('Total egresos', d.totales.egresos, { bold:true, color: CO.red, trClass:'totrow' })}
      </tbody>
    </table>
  </div>

  <!-- RESULTADO por sede -->
  <div class="resstrip">
    <div class="lab"><span class="k">Resultado del mes</span><span class="v">${money(res, false)}</span></div>
    <div class="cols">
      ${[...PDF_SEDES,'general'].map(k => `
        <div class="c"><div class="k">${k==='general'?'General':(sedeLabels[k]||k)}</div>
          <div class="v" style="color:${(d.resultado[k]||0)>=0?CO.green:CO.red}">${money(d.resultado[k]||0, false)}</div></div>`).join('')}
    </div>
  </div>

  <!-- ALUMNOS POR DISCIPLINA -->
  <div class="card">
    <div class="cap"><span class="dot" style="background:${CO.brand}"></span><span class="tt">Alumnos por disciplina — ${label}</span></div>
    <table>
      <thead class="thead"><tr>
        <th style="text-align:left;">Disciplina</th>
        <th style="text-align:left;"></th>
        <th style="text-align:center;">Alumnos</th>
        <th style="text-align:right;">Total cuotas</th>
      </tr></thead>
      <tbody>${filasDisc || `<tr><td colspan="4" style="padding:8px 10px;color:#cbd5e1;">Sin pagos registrados</td></tr>`}</tbody>
    </table>
  </div>

  <!-- TICKET -->
  <div class="ticket">
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${CO.muted};">Ticket promedio</div>
      <div style="font-size:11px;color:${CO.muted};margin-top:2px;">Sin Kids ni Teens · sobre ${d.ticket.alumnos} alumnos</div>
    </div>
    <div class="big" style="margin-left:auto;">${money(d.ticket.promedio, false)}</div>
  </div>

  <div class="foot">${nombre} · Informe de ${label}${ciudad ? ' · ' + ciudad : ''}</div>

  ${paginaVentas(d, label, logoUrl, hoy, nombre, ciudad, sedeLabels)}

  <script>window.onload = () => window.print()<\/script>
</body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}
