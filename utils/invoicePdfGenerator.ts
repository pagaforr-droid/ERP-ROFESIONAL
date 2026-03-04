import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyConfig, Sale } from '../types';

// --- NUMBER TO WORDS CONVERTER ---
const Unidades = (num: number) => {
    switch (num) {
        case 1: return 'UN';
        case 2: return 'DOS';
        case 3: return 'TRES';
        case 4: return 'CUATRO';
        case 5: return 'CINCO';
        case 6: return 'SEIS';
        case 7: return 'SIETE';
        case 8: return 'OCHO';
        case 9: return 'NUEVE';
        default: return '';
    }
};

const Decenas = (num: number) => {
    const decena = Math.floor(num / 10);
    const unidad = num - (decena * 10);
    switch (decena) {
        case 1:
            switch (unidad) {
                case 0: return 'DIEZ';
                case 1: return 'ONCE';
                case 2: return 'DOCE';
                case 3: return 'TRECE';
                case 4: return 'CATORCE';
                case 5: return 'QUINCE';
                default: return 'DIECI' + Unidades(unidad);
            }
        case 2:
            switch (unidad) {
                case 0: return 'VEINTE';
                default: return 'VEINTI' + Unidades(unidad);
            }
        case 3: return DecenasY('TREINTA', unidad);
        case 4: return DecenasY('CUARENTA', unidad);
        case 5: return DecenasY('CINCUENTA', unidad);
        case 6: return DecenasY('SESENTA', unidad);
        case 7: return DecenasY('SETENTA', unidad);
        case 8: return DecenasY('OCHENTA', unidad);
        case 9: return DecenasY('NOVENTA', unidad);
        case 0: return Unidades(unidad);
        default: return '';
    }
};

const DecenasY = (strSin: string, numUnidades: number) => {
    if (numUnidades > 0) return strSin + ' Y ' + Unidades(numUnidades);
    return strSin;
};

const Centenas = (num: number) => {
    const centenas = Math.floor(num / 100);
    const decenas = num - (centenas * 100);
    switch (centenas) {
        case 1:
            if (decenas > 0) return 'CIENTO ' + Decenas(decenas);
            return 'CIEN';
        case 2: return 'DOSCIENTOS ' + Decenas(decenas);
        case 3: return 'TRESCIENTOS ' + Decenas(decenas);
        case 4: return 'CUATROCIENTOS ' + Decenas(decenas);
        case 5: return 'QUINIENTOS ' + Decenas(decenas);
        case 6: return 'SEISCIENTOS ' + Decenas(decenas);
        case 7: return 'SETECIENTOS ' + Decenas(decenas);
        case 8: return 'OCHOCIENTOS ' + Decenas(decenas);
        case 9: return 'NOVECIENTOS ' + Decenas(decenas);
        default: return Decenas(decenas);
    }
};

const Seccion = (num: number, divisor: number, strSingular: string, strPlural: string) => {
    const cientos = Math.floor(num / divisor);
    const resto = num - (cientos * divisor);
    let letras = '';
    if (cientos > 0) {
        if (cientos > 1) letras = Centenas(cientos) + ' ' + strPlural;
        else letras = strSingular;
    }
    if (resto > 0) letras += '';
    return letras;
};

const Miles = (num: number) => {
    const divisor = 1000;
    const cientos = Math.floor(num / divisor);
    const resto = num - (cientos * divisor);
    const strMiles = Seccion(num, divisor, 'UN MIL', 'MIL');
    const strCentenas = Centenas(resto);
    if (strMiles === '') return strCentenas;
    return strMiles + ' ' + strCentenas;
};

const Millones = (num: number) => {
    const divisor = 1000000;
    const cientos = Math.floor(num / divisor);
    const resto = num - (cientos * divisor);
    const strMillones = Seccion(num, divisor, 'UN MILLON', 'MILLONES');
    const strMiles = Miles(resto);
    if (strMillones === '') return strMiles;
    return strMillones + ' ' + strMiles;
};

export const numberToWords = (num: number): string => {
    const data = {
        entero: Math.floor(num),
        decimal: Math.round((num - Math.floor(num)) * 100),
    };
    if (data.entero === 0) return `CERO CON ${data.decimal}/100`;
    const decimalStr = data.decimal < 10 ? `0${data.decimal}` : `${data.decimal}`;
    return `${Millones(data.entero)} CON ${decimalStr}/100`;
};

// --- PDF GENERATOR CORE ---

export const generateMassiveInvoicePDF = (company: CompanyConfig, sales: Sale[]) => {
    const doc = new jsPDF('p', 'mm', 'a4'); // A4 Portrait 210x297
    const w = 210;
    const h = 297;
    const margin = 10;

    const drawHalf = (sale: Sale, startY: number, titleLabel: string) => {
        // Background (for debugging boundaries, usually white)
        doc.setFillColor(255, 255, 255);
        doc.rect(0, startY, w, h / 2, 'F');

        let currentY = startY + margin;

        // 1. Header (Logo/Name + RUC Box)
        // a) Company Info
        if (company.logo_url) {
            try {
                // Very simplistic handling of standard paths
                // Realistically to support all image types reliably in jsPDF without blocking, 
                // base64 strings or static assets need proper Promise handling, 
                // but for immediate translation we'll add the placeholder path
                doc.addImage(company.logo_url, 'JPEG', margin, currentY, 40, 15);
            } catch (e) {
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text("LOGO", margin, currentY + 6);
            }
        } else {
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text("LOGO", margin, currentY + 6);
        }

        currentY += 18;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(company.name.toUpperCase(), margin, currentY);

        currentY += 4;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(company.address, margin, currentY);
        currentY += 3;
        doc.text(`Tlfno: ${company.phone || '-'}`, margin, currentY);

        // b) RUC Box (Top Right)
        const rucBoxW = 75;
        const rucBoxH = 22;
        const rucBoxX = w - margin - rucBoxW;
        const rucBoxY = startY + margin;

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.rect(rucBoxX, rucBoxY, rucBoxW, rucBoxH, 'S');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`R.U.C. ${company.ruc}`, rucBoxX + rucBoxW / 2, rucBoxY + 6, { align: 'center' });

        const docTypeLabel = sale.document_type === 'FACTURA' ? 'FACTURA ELECTRONICA' : sale.document_type === 'NOTA_CREDITO' ? 'NOTA DE CREDITO ELECTRONICA' : 'BOLETA DE VENTA ELECTRONICA';

        doc.setFillColor(240, 240, 240);
        doc.rect(rucBoxX, rucBoxY + 8, rucBoxW, 7, 'F');
        doc.line(rucBoxX, rucBoxY + 8, rucBoxX + rucBoxW, rucBoxY + 8);
        doc.line(rucBoxX, rucBoxY + 15, rucBoxX + rucBoxW, rucBoxY + 15);

        doc.setFontSize(10);
        doc.text(docTypeLabel, rucBoxX + rucBoxW / 2, rucBoxY + 13, { align: 'center' });

        doc.setFontSize(12);
        doc.text(`${sale.series}-${sale.number}`, rucBoxX + rucBoxW / 2, rucBoxY + 20, { align: 'center' });

        // Label (EMISOR / ADQUIRENTE) rotated 90 degrees on the left margin
        doc.setFontSize(8);
        doc.setTextColor(150);
        const textX = 4;
        const textY = startY + (h / 4) + 10;
        doc.text(titleLabel, textX, textY, { angle: 90 });
        doc.setTextColor(0);

        // 2. Client Grid
        currentY = Math.max(currentY + 6, rucBoxY + rucBoxH + 4);
        doc.setLineWidth(0.3);
        doc.rect(margin, currentY, w - (margin * 2), 20, 'S');

        doc.setFontSize(7);
        const gridMarginY = currentY + 4;

        doc.setFont('helvetica', 'bold');
        doc.text('Señor(es):', margin + 2, gridMarginY);
        doc.text('Fecha Emisión:', w / 2 + 10, gridMarginY);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.client_name.substring(0, 50).toUpperCase(), margin + 20, gridMarginY);
        doc.text(new Date(sale.created_at).toLocaleDateString('es-PE'), w - margin - 2, gridMarginY, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Dirección:', margin + 2, gridMarginY + 4);
        doc.text('Condición:', w / 2 + 10, gridMarginY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text((sale.client_address || '-').substring(0, 50).toUpperCase(), margin + 20, gridMarginY + 4);
        doc.text(sale.payment_method, w - margin - 2, gridMarginY + 4, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text(sale.client_ruc.length === 11 ? 'RUC:' : 'DNI:', margin + 2, gridMarginY + 8);
        doc.text('Moneda:', w / 2 + 10, gridMarginY + 8);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.client_ruc, margin + 20, gridMarginY + 8);
        doc.text('SOLES', w - margin - 2, gridMarginY + 8, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Cod. Cliente:', margin + 2, gridMarginY + 12);
        doc.text('Vendedor:', w / 2 + 10, gridMarginY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text('002674', margin + 20, gridMarginY + 12);
        doc.text('VENDEDOR 01', w - margin - 2, gridMarginY + 12, { align: 'right' });

        currentY += 22;

        // 3. Items AutoTable
        const itemsBody = sale.items.map(item => [
            item.product_sku,
            item.quantity_presentation.toString(),
            item.selected_unit === 'PKG' ? 'CJA' : 'UND',
            `${item.product_name.toUpperCase()} ${item.is_bonus ? '- BONIFICACION' : ''}`,
            item.unit_price.toFixed(2),
            item.discount_amount > 0 ? item.discount_amount.toFixed(2) : '',
            item.total_price.toFixed(2)
        ]);

        let finalTableY = currentY;

        autoTable(doc, {
            startY: currentY,
            head: [['Código', 'Cant.', 'U.M.', 'Descripción', 'P.Unit', 'Dscto', 'Total']],
            body: itemsBody,
            theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 20 },
                1: { halign: 'center', cellWidth: 10 },
                2: { halign: 'center', cellWidth: 10 },
                3: { halign: 'left' }, // auto width
                4: { halign: 'right', cellWidth: 15 },
                5: { halign: 'right', cellWidth: 12 },
                6: { halign: 'right', cellWidth: 18 }
            },
            margin: { left: margin, right: margin },
            didDrawPage: (data) => {
                // Limits height per half
                // Usually we wouldn't let autoTable paginate wildly during a Half render, 
                // so we assume standard sales don't overflow ~10 rows per half.
                finalTableY = data.cursor ? data.cursor.y : currentY;
            }
        });

        // 4. Footer
        // Stick footer to bottom of the 'Half' (e.g. at Y = startY + 148.5 - 25)
        const footerY = startY + 115; // Fixed height area for footer

        // Draw outer boundary for item table padding bridging gap to footer
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(margin, finalTableY, margin, footerY); // left vertical
        doc.line(w - margin, finalTableY, w - margin, footerY); // right vertical

        // Top line of footer
        doc.line(margin, footerY, w - margin, footerY);

        // Number to Words
        const totalWords = `${numberToWords(sale.total)} SOLES`;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(`SON: ${totalWords}`, margin + 2, footerY + 4);
        doc.line(margin, footerY + 6, w - margin - 50, footerY + 6); // Divider under Son

        // QR Placeholder
        doc.rect(margin + 2, footerY + 8, 15, 15, 'S');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text('QR', margin + 6.5, footerY + 16.5);

        doc.setFont('helvetica', 'bold');
        doc.text('ERP TraceFlow®', margin + 20, footerY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Resumen Hash: ${crypto.randomUUID().slice(0, 15)}`, margin + 20, footerY + 15);
        doc.text('Representación Impresa del Comprobante Electrónico', margin + 20, footerY + 18);

        // Financials Block (Right side)
        const finX = w - margin - 50;
        doc.line(finX, footerY, finX, footerY + 25); // Vertical separator

        const finY1 = footerY + 4;
        const finY2 = footerY + 10;
        const finY3 = footerY + 16;
        const finY4 = footerY + 22;

        doc.setFontSize(6);
        doc.text('Op. Gravada:', finX + 2, finY1);
        doc.text(sale.subtotal.toFixed(2), w - margin - 2, finY1, { align: 'right' });
        doc.line(finX, finY1 + 2, w - margin, finY1 + 2);

        doc.text('Op. Inafecta:', finX + 2, finY2);
        doc.text('0.00', w - margin - 2, finY2, { align: 'right' });
        doc.line(finX, finY2 + 2, w - margin, finY2 + 2);

        doc.text('I.G.V.:', finX + 2, finY3);
        doc.text(sale.igv.toFixed(2), w - margin - 2, finY3, { align: 'right' });
        doc.line(finX, finY3 + 2, w - margin, finY3 + 2);

        doc.setFont('helvetica', 'bold');
        doc.setFillColor(245, 245, 245);
        doc.rect(finX, finY3 + 2, 50, 7, 'F');
        doc.text('TOTAL:', finX + 2, finY4);
        doc.text(`S/ ${sale.total.toFixed(2)}`, w - margin - 2, finY4, { align: 'right' });

        // Bottom close
        doc.line(margin, footerY + 25, w - margin, footerY + 25);
    };

    // Build loop
    sales.forEach((sale, index) => {
        if (index > 0) doc.addPage();

        // Top Half
        drawHalf(sale, 0, 'EMISOR');

        // Cut Line (Dashed)
        doc.setDrawColor(0);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(0, 148.5, w, 148.5);
        doc.setLineDashPattern([], 0); // reset

        const txt = 'CORTAR AQUÍ';
        doc.setFontSize(6);
        doc.setFillColor(255, 255, 255);
        const textW = doc.getTextWidth(txt);
        doc.rect((w / 2) - (textW / 2) - 1, 147, textW + 2, 3, 'F');
        doc.text(txt, w / 2, 149.2, { align: 'center' });

        // Bottom Half
        drawHalf(sale, 148.5, 'ADQUIRENTE / SUNAT');
    });

    // Generate File and Open
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
};
