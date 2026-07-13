import logoNegroAsset from '../assets/logo-negro.jpg'

const DIAS_ES = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado' }

// Fallback en caso de que el catálogo dinámico de disciplinas no se haya pasado o cargado
const DISC_LABEL_FB = { CF: 'CrossFit', HF: 'Heavy Funcional', HX: 'Hyrox', FB: 'FullBody', TN: 'Teens', KD: 'Kids', BP: 'Bonus Pack' }

function estado(p) {
  if (p.pagada)     return { texto: 'PAGADA',     color: '#d97706' }
  if (p.confirmada) return { texto: 'CONFIRMADA', color: '#16a34a' }
  return               { texto: 'PENDIENTE',   color: '#6b7280' }
}

function paginaProfe(p, mesLabel, discLabel, logoUrl, nombre) {
  const clases = [...(p.clases ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
  const porDia = []
  let diaActual = null
  for (const c of clases) {
    if (c.fecha !== diaActual) { porDia.push({ fecha: c.fecha, dia: c.dia, clases: [] }); diaActual = c.fecha }
    porDia[porDia.length - 1].clases.push(c)
  }
  const est = estado(p)
  const tipo = p.tipo_liquidacion === 'hora'  ? `$${p.valor_hora.toLocaleString('es-AR')}/h`
             : p.tipo_liquidacion === 'fijo'  ? 'Sueldo fijo'
             : p.tipo_liquidacion === 'mixto' ? 'Horas + %'
             : 'Porcentaje'

  const bloquePorcentaje = (p.tipo_liquidacion === 'mixto' || (p.tipo_liquidacion === 'porcentaje' && p.base)) ? `
    <div style="margin-top:14px; padding:10px 14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; display:flex; justify-content:space-between; font-size:12px;">
      ${p.tipo_liquidacion === 'mixto' ? `<span><b>Horas:</b> $${(p.monto_horas ?? 0).toLocaleString('es-AR')}</span>` : ''}
      <span><b>Base:</b> $${(p.base ?? 0).toLocaleString('es-AR')}</span>
      <span><b>Porcentaje:</b> ${p.porcentaje}%</span>
      <span><b>Total:</b> $${p.monto_final.toLocaleString('es-AR')}</span>
    </div>
  ` : ''

  const filasDia = porDia.map(d => {
    const fecha = new Date(d.fecha + 'T12:00:00')
    const fechaFmt = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const diaFmt = DIAS_ES[d.dia] ?? d.dia
    return `
      <tr class="dia-header">
        <td colspan="3" style="padding:6px 10px 3px; font-size:11px; font-weight:700; color:#374151; background:#f3f4f6; border-top:2px solid #e5e7eb;">
          ${diaFmt} ${fechaFmt}
        </td>
      </tr>
      ${d.clases.map(c => `
        <tr>
          <td style="padding:4px 10px; font-size:11px; color:#111827;">${c.hora}</td>
          <td style="padding:4px 10px; font-size:11px; color:#111827;">${discLabel[c.disciplina] ?? c.disciplina}</td>
          <td style="padding:4px 10px; font-size:11px; color:#6b7280;">Athlon ${c.sede}</td>
        </tr>
      `).join('')}
    `
  }).join('')

  return `
    <div class="pagina">
      <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
        <img src="${logoUrl}" alt="${nombre}" style="height:26px;"/>
      </div>
      <div class="header-profe">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:48px; height:48px; border-radius:50%; background:${p.profe_color || '#6b7280'}; display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:18px; flex-shrink:0;">
            ${p.profe_nombre.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style="font-size:20px; font-weight:800; color:#111827;">${p.profe_nombre}</div>
            <div style="font-size:13px; color:#6b7280; margin-top:2px;">Liquidación ${mesLabel}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px; font-weight:700; letter-spacing:1px; color:${est.color}; background:${est.color}18; border:1px solid ${est.color}44; padding:3px 10px; border-radius:20px; display:inline-block;">${est.texto}</div>
          <div style="font-size:22px; font-weight:800; color:#111827; margin-top:6px;">$${p.monto_final.toLocaleString('es-AR')}</div>
          <div style="font-size:11px; color:#6b7280;">${p.clases_dadas} clases · ${tipo}</div>
        </div>
      </div>

      <table class="tabla-clases">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Disciplina</th>
            <th>Sede</th>
          </tr>
        </thead>
        <tbody>${filasDia}</tbody>
      </table>
      ${bloquePorcentaje}

      <div class="footer-profe">
        <span>${nombre} · ${mesLabel}</span>
        <span style="font-weight:700;">Total: $${p.monto_final.toLocaleString('es-AR')}</span>
      </div>
    </div>
  `
}

/**
 * Abre una ventana de impresión con una página por cada profe en `profes`.
 * `discLabelMap` es el catálogo dinámico de disciplinas ({ CF: 'CrossFit', ... }
 * desde `useDisciplinas()`); si falta algún código, se usa el fallback interno.
 */
export function abrirPDFLiquidaciones(profes, mesLabel, discLabelMap = {}, branding = {}) {
  const discLabel = { ...DISC_LABEL_FB, ...discLabelMap }
  const logoUrl = branding.logoUrl || `${window.location.origin}${logoNegroAsset}`
  const nombre  = branding.nombre || 'Athlon'
  const titulo = profes.length === 1
    ? `Liquidación ${profes[0].profe_nombre} — ${mesLabel}`
    : `Liquidaciones ${mesLabel}`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${titulo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; background: white; }
    .pagina {
      width: 210mm; min-height: 297mm;
      padding: 18mm 16mm 14mm;
      page-break-after: always;
      display: flex; flex-direction: column;
    }
    .header-profe {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid #111827; padding-bottom: 14px; margin-bottom: 16px;
    }
    .tabla-clases { width: 100%; border-collapse: collapse; flex: 1; }
    .tabla-clases thead tr { background: #111827; }
    .tabla-clases thead th {
      padding: 7px 10px; font-size: 11px; font-weight: 700;
      color: white; text-align: left; letter-spacing: 0.5px;
    }
    .tabla-clases tbody tr:nth-child(even):not(.dia-header) { background: #f9fafb; }
    .tabla-clases tbody tr:hover { background: #f3f4f6; }
    .footer-profe {
      margin-top: auto; padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between;
      font-size: 11px; color: #9ca3af;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pagina { page-break-after: always; }
    }
  </style>
</head>
<body>
  ${profes.map(p => paginaProfe(p, mesLabel, discLabel, logoUrl, nombre)).join('')}
  <script>window.onload = () => window.print()<\/script>
</body>
</html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}
