import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/** Export a DOM node as A4 PDF. */
export async function downloadCvAsPdf(element: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const imgW = pageW
  const imgH = (canvas.height * pageW) / canvas.width

  if (imgH <= pageH) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH)
  } else {
    let heightLeft = imgH
    let y = 0
    pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0.5) {
      y = heightLeft - imgH
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH)
      heightLeft -= pageH
    }
  }

  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}
