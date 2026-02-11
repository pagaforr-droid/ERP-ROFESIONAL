import React from 'react';
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
      <div className="h-[140mm] relative flex flex-col justify-between p-4 text-black" style={{ fontFamily: '"Arial Narrow", Arial, sans-serif' }}>
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
            <div className="w-[40%] border border-black rounded-lg p-1 text-center">
               <h2 className="font-bold text-[11px] mb-0.5 text-black">R.U.C. {company.ruc}</h2>
               <div className="bg-slate-100 py-0.5 font-bold text-[11px] mb-0.5 uppercase border-y border-black text-black">
                  {sale.document_type === 'FACTURA' ? 'FACTURA ELECTRONICA' : 'BOLETA DE VENTA ELECTRONICA'}
               </div>
               <h3 className="font-bold text-[11px] text-black">{sale.series}-{sale.number}</h3>
            </div>
         </div>

         {/* --- CLIENT GRID --- */}
         <div className="border border-black rounded-sm p-1.5 mb-1 text-[9px] leading-3 text-black">
            <div className="grid grid-cols-12 gap-x-1">
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
            <table className="w-full text-[9px] border-collapse text-black">
               <thead>
                  <tr className="border-b border-black">
                     <th className="font-bold text-center border-r border-black w-12">Código</th>
                     <th className="font-bold text-center border-r border-black w-8">Cant.</th>
                     <th className="font-bold text-center border-r border-black w-8">U.M.</th>
                     <th className="font-bold text-left px-1 border-r border-black">Descripción</th>
                     <th className="font-bold text-right px-1 border-r border-black w-14">P.Unit</th>
                     <th className="font-bold text-right px-1 border-r border-black w-10">Dscto</th>
                     <th className="font-bold text-right px-1 w-16">Total</th>
                  </tr>
               </thead>
               <tbody>
                  {sale.items.map((item, i) => (
                     <tr key={i} className="align-top">
                        <td className="text-center border-r border-black py-0.5">{item.product_sku}</td>
                        <td className="text-center border-r border-black py-0.5">{item.quantity_presentation}</td>
                        <td className="text-center border-r border-black py-0.5">{item.selected_unit === 'PKG' ? 'CJA' : 'UND'}</td>
                        <td className="px-1 border-r border-black py-0.5 uppercase tracking-tighter">
                           {item.product_name} {item.is_bonus ? '**BONIF**' : ''}
                        </td>
                        <td className="text-right px-1 border-r border-black py-0.5">{item.unit_price.toFixed(2)}</td>
                        <td className="text-right px-1 border-r border-black py-0.5">{item.discount_amount > 0 ? item.discount_amount.toFixed(2) : ''}</td>
                        <td className="text-right px-1 py-0.5">{item.total_price.toFixed(2)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {/* --- FOOTER --- */}
         <div className="border border-t-0 border-black p-1 text-[9px] text-black">
            <div className="flex justify-between items-start gap-2">

               {/* Text & QR */}
               <div className="flex-1">
                  <div className="font-bold border-b border-black mb-1 pb-0.5 text-black">SON: {totalWords}</div>
                  <div className="flex gap-2">
                     <div className="w-14 h-14 bg-white border border-black">
                        <div className="w-full h-full flex items-center justify-center text-[6px] text-center bg-white text-black">QR</div>
                     </div>
                     <div className="flex-1 text-[8px] text-black leading-none space-y-0.5">
                        <p className="font-bold">ERP TraceFlow®</p>
                        <p>Resumen Hash: {crypto.randomUUID().slice(0, 15)}</p>
                        <p>Representación Impresa del Comprobante Electrónico</p>
                     </div>
                  </div>
               </div>

               {/* Numbers */}
               <div className="w-32 text-black">
                  <div className="flex justify-between border-b border-black">
                     <span>Op. Gravada:</span>
                     <span>{sale.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-black">
                     <span>Op. Inafecta:</span>
                     <span>0.00</span>
                  </div>
                  <div className="flex justify-between border-b border-black">
                     <span>I.G.V.:</span>
                     <span>{sale.igv.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-black font-bold bg-slate-50">
                     <span>TOTAL:</span>
                     <span>S/ {sale.total.toFixed(2)}</span>
                  </div>
               </div>
            </div>
         </div>

         {label && (
            <div className="absolute top-1/2 left-0 -rotate-90 origin-left text-[8px] text-black font-bold ml-1 mt-6">
               {label}
            </div>
         )}
      </div>
   );
};


// --- MAIN LAYOUT ---
export const PrintableInvoice: React.FC<Props> = ({ company, sales, onClose }) => {

   React.useEffect(() => {
      setTimeout(() => {
         window.print();
      }, 800);
   }, []);

   return (
      <div className="fixed inset-0 bg-slate-800/90 z-[9999] flex justify-center overflow-auto p-4 print:p-0 print:bg-white print:static print:overflow-visible">

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
         <div>
            {sales.map((sale, index) => (
               <div
                  key={sale.id}
                  className="bg-white mx-auto shadow-2xl print:shadow-none mb-8 print:mb-0 relative text-black"
                  style={{
                     width: '210mm',
                     height: '296mm', // Exact A4
                     pageBreakAfter: 'always',
                     overflow: 'hidden',
                     fontFamily: '"Arial Narrow", Arial, sans-serif'
                  }}
               >
                  {/* ORIGINAL (TOP) */}
                  <InvoiceHalf company={company} sale={sale} label="EMISOR" />

                  {/* CUT LINE */}
                  <div className="w-full border-t border-dashed border-black flex justify-center items-center h-[4mm]">
                     <span className="bg-white px-2 text-[8px] text-black">CORTAR AQUÍ</span>
                  </div>

                  {/* COPY (BOTTOM) */}
                  <InvoiceHalf company={company} sale={sale} label="ADQUIRENTE / SUNAT" />

                  {/* PAGE NUMBER (INTERNAL) */}
                  <div className="absolute bottom-1 right-2 text-[8px] text-black">
                     Pág. {index + 1} de {sales.length}
                  </div>
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
          }
          * {
            color: black !important;
            border-color: black !important;
          }
          /* Hide everything else */
          body > *:not(#root) { display: none; }
        }
      `}</style>
      </div>
   );
};