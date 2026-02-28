import React from 'react';
import { createPortal } from 'react-dom';
import { CompanyConfig, Sale } from '../types';

interface Props {
   company: CompanyConfig;
   sales: Sale[]; // Changed to Array for Batch Printing
   onClose: () => void;
}

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

const numberToWords = (num: number): string => {
   const data = {
      entero: Math.floor(num),
      decimal: Math.round((num - Math.floor(num)) * 100),
   };

   if (data.entero === 0) return `CERO CON ${data.decimal}/100`;

   // Format decimal to always have 2 digits (e.g. 5 -> 05)
   const decimalStr = data.decimal < 10 ? `0${data.decimal}` : `${data.decimal}`;

   return `${Millones(data.entero)} CON ${decimalStr}/100`;
};

// --- SINGLE INVOICE HALF COMPONENT ---
const InvoiceHalf: React.FC<{ company: CompanyConfig; sale: Sale; label?: string }> = ({ company, sale, label }) => {
   const totalWords = `${numberToWords(sale.total)} SOLES`;

   return (
      <div className="h-[137mm] relative flex flex-col justify-between text-black pl-5" style={{ fontFamily: '"Arial Narrow", Arial, sans-serif' }}>
         {/* --- HEADER --- */}
         <div className="flex justify-between mb-2">
            {/* Logo & Company */}
            <div className="w-[55%]">
               {company.logo_url ? (
                  <img src={company.logo_url} alt="Logo" className="h-10 mb-1 object-contain" />
               ) : (
                  <div className="font-bold text-lg uppercase bg-black text-white inline-block px-2 mb-1">LOGO</div>
               )}
               <h1 className="font-bold text-[10px] uppercase text-black">{company.name}</h1>
               <div className="text-[8px] text-black leading-tight">
                  <p>{company.address}</p>
                  <p>Tlfno: {company.phone}</p>
               </div>
            </div>

            {/* RUC Box */}
            <div className="w-[40%] border border-black rounded-lg p-0.5 text-center">
               <h2 className="font-bold text-[9px] mb-[1px] text-black">R.U.C. {company.ruc}</h2>
               <div className="bg-slate-100 py-[1px] font-bold text-[9px] mb-[1px] uppercase border-y border-black text-black">
                  {sale.document_type === 'FACTURA' ? 'FACTURA ELECTRONICA' : sale.document_type === 'NOTA_CREDITO' ? 'NOTA DE CREDITO ELECTRONICA' : 'BOLETA DE VENTA ELECTRONICA'}
               </div>
               <h3 className="font-bold text-[10px] text-black">{sale.series}-{sale.number}</h3>
            </div>
         </div>

         {/* --- CLIENT GRID --- */}
         <div className="border border-black rounded-sm p-1 mb-1 text-[7px] leading-[12px] text-black">
            <div className="grid grid-cols-12 gap-x-1 gap-y-[1px]">
               <div className="col-span-2 font-bold">Señor(es):</div>
               <div className="col-span-6 uppercase">{sale.client_name}</div>
               <div className="col-span-2 font-bold text-right">Fecha Emisión:</div>
               <div className="col-span-2 text-right">{new Date(sale.created_at).toLocaleDateString('es-PE')}</div>

               <div className="col-span-2 font-bold">Dirección:</div>
               <div className="col-span-6 uppercase truncate">{sale.client_address || '-'}</div>
               <div className="col-span-2 font-bold text-right">Condición:</div>
               <div className="col-span-2 text-right">{sale.payment_method}</div>

               <div className="col-span-2 font-bold">{sale.client_ruc.length === 11 ? 'RUC' : 'DNI'}:</div>
               <div className="col-span-6">{sale.client_ruc}</div>
               <div className="col-span-2 font-bold text-right">Moneda:</div>
               <div className="col-span-2 text-right">SOLES</div>

               <div className="col-span-2 font-bold">Cod. Cliente:</div>
               <div className="col-span-2">002674</div>
               <div className="col-span-4 font-bold text-right">Vendedor:</div>
               <div className="col-span-4 text-right truncate">VENDEDOR 01</div>
            </div>
         </div>

         {/* --- ITEMS TABLE --- */}
         <div className="flex-1 border border-black min-h-[50mm] relative">
            <table className="w-full text-[5px] border-collapse text-black">
               <thead>
                  <tr className="border-b border-black bg-slate-50 leading-[7px]">
                     <th className="font-bold text-center w-12 tracking-tight">Código</th>
                     <th className="font-bold text-center w-8 tracking-tight">Cant.</th>
                     <th className="font-bold text-center w-8 tracking-tight">U.M.</th>
                     <th className="font-bold text-left px-1 tracking-tight">Descripción</th>
                     <th className="font-bold text-right px-1 w-14 tracking-tight">P.Unit</th>
                     <th className="font-bold text-right px-1 w-10 tracking-tight">Dscto</th>
                     <th className="font-bold text-right px-1 w-16 tracking-tight">Total</th>
                  </tr>
               </thead>
               <tbody>
                  {sale.items.map((item, i) => (
                     <tr key={i} className="align-middle border-b border-dashed border-slate-300 last:border-0 leading-[8px]">
                        <td className="text-center py-[1.5mm]">{item.product_sku}</td>
                        <td className="text-center py-[1.5mm]">{item.quantity_presentation}</td>
                        <td className="text-center py-[1.5mm]">{item.selected_unit === 'PKG' ? 'CJA' : 'UND'}</td>
                        <td className="px-1 py-[1.5mm] uppercase tracking-tighter truncate max-w-[120px]">
                           {item.product_name} {item.is_bonus ? '**BONIF**' : ''}
                        </td>
                        <td className="text-right px-1 py-[1.5mm]">{item.unit_price.toFixed(2)}</td>
                        <td className="text-right px-1 py-[1.5mm]">{item.discount_amount > 0 ? item.discount_amount.toFixed(2) : ''}</td>
                        <td className="text-right px-1 py-[1.5mm]">{item.total_price.toFixed(2)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {/* --- FOOTER --- */}
         <div className="border border-t-0 border-black p-1 text-[7px] text-black">
            <div className="flex justify-between items-start gap-2">

               {/* Text & QR */}
               <div className="flex-1">
                  <div className="font-bold border-b border-black mb-1 pb-0.5 text-black">SON: {totalWords}</div>
                  <div className="flex gap-2">
                     <div className="w-12 h-12 bg-white border border-black">
                        <div className="w-full h-full flex items-center justify-center text-[5px] text-center bg-white text-black">QR</div>
                     </div>
                     <div className="flex-1 text-[6.5px] text-black leading-tight space-y-[2px]">
                        <p className="font-bold">ERP TraceFlow®</p>
                        <p>Resumen Hash: {crypto.randomUUID().slice(0, 15)}</p>
                        <p>Representación Impresa del Comprobante Electrónico</p>
                     </div>
                  </div>
               </div>

               {/* Numbers */}
               <div className="w-28 text-black text-[6px] leading-[8px]">
                  <div className="flex justify-between border-b border-black py-[4px]">
                     <span>Op. Gravada:</span>
                     <span>{sale.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-black py-[4px]">
                     <span>Op. Inafecta:</span>
                     <span>0.00</span>
                  </div>
                  <div className="flex justify-between border-b border-black py-[4px]">
                     <span>I.G.V.:</span>
                     <span>{sale.igv.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-black font-bold bg-slate-50 py-[4px]">
                     <span>TOTAL:</span>
                     <span>S/ {sale.total.toFixed(2)}</span>
                  </div>
               </div>
            </div>
         </div>

         {label && (
            <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center text-[10px] text-black font-bold tracking-[0.2em]">
               {label}
            </div>
         )}
      </div>
   );
};


// --- MAIN LAYOUT ---
export const PrintableInvoice: React.FC<Props> = ({ company, sales, onClose }) => {

   React.useEffect(() => {
      const timer = setTimeout(() => {
         window.print();
      }, 500);
      return () => clearTimeout(timer);
   }, []);

   const content = (
      <div className="fixed inset-0 bg-slate-800/90 z-[99999] flex justify-center overflow-auto p-4 print:p-0 print:bg-transparent print:static print:inset-auto print:overflow-visible print:block">

         {/* Controls */}
         <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
            <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow flex items-center">
               IMPRIMIR LOTE ({sales.length})
            </button>
            <button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded shadow">
               Cerrar
            </button>
         </div>

         {/* DOCUMENT FLOW CONTAINER */}
         <div className="w-full print:w-[210mm] mx-auto">
            {sales.map((sale, index) => (
               <div
                  key={sale.id}
                  className="bg-white mx-auto shadow-2xl print:shadow-none mb-8 print:mb-0 relative text-black p-[10mm]"
                  style={{
                     width: '210mm',
                     height: '297mm', // Exact A4
                     boxSizing: 'border-box',
                     pageBreakAfter: 'always',
                     overflow: 'hidden',
                     fontFamily: '"Arial Narrow", Arial, sans-serif'
                  }}
               >
                  {/* ORIGINAL (TOP) */}
                  <InvoiceHalf company={company} sale={sale} label="EMISOR" />

                  {/* CUT LINE */}
                  <div className="w-full border-t border-dashed border-black flex justify-center items-center h-[3mm]">
                     <span className="bg-white px-2 text-[8px] text-black">CORTAR AQUÍ</span>
                  </div>

                  {/* COPY (BOTTOM) */}
                  <InvoiceHalf company={company} sale={sale} label="ADQUIRENTE / SUNAT" />
               </div>
            ))}
         </div>

         <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            color: black;
            background-color: white;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          * {
            color: black !important;
            border-color: black !important;
            box-sizing: border-box !important;
          }
          
          /* Enforce absolute breakaway behavior */
          body {
            position: static !important;
            overflow: visible !important;
          }
          
          #root {
             display: none !important;
          }
          
          html, body {
             height: auto !important;
             min-height: 100%;
             overflow: visible !important;
          }
          
          /* Hide non-printable app UI elements by default classes */
          .print\\:hidden { display: none !important; }
        }
      `}</style>
      </div>
   );

   return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};