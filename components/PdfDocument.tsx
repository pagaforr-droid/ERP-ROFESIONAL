import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { numberToWords } from '../utils/numberToWords';

const styles = StyleSheet.create({
  pagePortrait: { flexDirection: 'column', backgroundColor: '#ffffff', padding: 20, fontFamily: 'Helvetica' },
  pageLandscape: { flexDirection: 'row', backgroundColor: '#ffffff', padding: 20, fontFamily: 'Helvetica', justifyContent: 'space-between' },
  halfPage: { width: '48%', height: '100%', flexDirection: 'column' },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  logoBox: { width: 50, height: 40, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  logoText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  companyCenter: { flex: 1, paddingHorizontal: 10, textAlign: 'center' },
  companyName: { fontSize: 11, fontWeight: 'bold' },
  companyAddress: { fontSize: 6, marginTop: 2 },
  rucBox: { width: 160, borderWidth: 1, borderColor: '#000', padding: 5, alignItems: 'center' },
  rucTop: { fontSize: 10, fontWeight: 'bold' },
  rucMid: { fontSize: 9, fontWeight: 'bold', marginVertical: 3, textAlign: 'center', width: '100%' },
  rucBot: { fontSize: 10, fontWeight: 'bold' },

  // Client Box
  clientBox: { borderWidth: 1, borderColor: '#000', padding: 2, marginBottom: 5, flexDirection: 'row' },
  clientCol1: { flex: 6 },
  clientCol2: { flex: 4 },
  clientRowInfo: { flexDirection: 'row', marginBottom: 1 },
  clientLabel: { fontSize: 7, fontWeight: 'bold', width: 45 },
  clientValue: { fontSize: 7, flex: 1 },

  // Table generic
  tableBox: { borderWidth: 1, borderColor: '#000', flex: 1, flexDirection: 'column' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 2 },
  th: { fontSize: 7, fontWeight: 'bold', paddingHorizontal: 2, borderRightWidth: 0.5, borderRightColor: '#000' },
  thLast: { fontSize: 7, fontWeight: 'bold', paddingHorizontal: 2 },
  tableRowItem: { flexDirection: 'row', paddingVertical: 3 },
  td: { fontSize: 7, paddingHorizontal: 2, borderRightWidth: 0.5, borderRightColor: '#000' },
  tdLast: { fontSize: 7, paddingHorizontal: 2 },

  // Columns dimensions
  colCod: { width: '12%' },
  colCant: { width: '8%', textAlign: 'center' },
  colUm: { width: '8%', textAlign: 'center' },
  colDesc: { flex: 1 },
  colPu: { width: '12%', textAlign: 'right' },
  colDscto: { width: '10%', textAlign: 'right' },
  colImporte: { width: '15%', textAlign: 'right' },

  // Footer / Totals
  sonBox: { borderTopWidth: 1, borderTopColor: '#000', padding: 3, flexDirection: 'row', justifyContent: 'space-between' },
  sonText: { fontSize: 7, fontWeight: 'bold' },
  totalSimpleBox: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: '#000' },
  totalLabelSimple: { fontSize: 8, fontWeight: 'bold', textAlign: 'right', padding: 2, borderRightWidth: 1, borderRightColor: '#000' },
  totalValueSimple: { fontSize: 8, textAlign: 'right', padding: 2, width: '15%' },

  // Factura Totals Grid
  facturaTotalsContainer: { flexDirection: 'row', borderWidth: 1, borderColor: '#000', marginTop: 4, height: 35 },
  qrBox: { width: 40, height: 33, margin: 1, borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  qrText: { fontSize: 4, color: '#999', textAlign: 'center' },
  totalsGrid: { flex: 1, flexDirection: 'row' },
  totCol: { flex: 1, borderLeftWidth: 1, borderLeftColor: '#000', flexDirection: 'column' },
  totHeader: { fontSize: 6, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#e0e0e0', borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 1 },
  totVal: { fontSize: 7, textAlign: 'right', padding: 2 },
  totRowInner: { flexDirection: 'row', flex: 1 },
  totColHalf: { flex: 1, borderRightWidth: 1, borderRightColor: '#000', flexDirection: 'column' },
  totColHalfLast: { flex: 1, flexDirection: 'column' },
  totHeaderHalf: { fontSize: 6, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#e0e0e0', borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 1 },

  legalText: { fontSize: 6, textAlign: 'center', marginTop: 10 },

  // GUIA STYLES (Retained from original)
  guiaInfoSection: { flexDirection: 'column', marginBottom: 5 },
  guiaInfoRow: { flexDirection: 'row', marginBottom: 3 },
  guiaInfoLabel: { fontSize: 8, fontWeight: 'bold', width: '18%' },
  guiaInfoValue: { fontSize: 8, width: '82%' },
  guiaEntitiesSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  guiaEntityBox: { width: '49%', flexDirection: 'column' },
  guiaEntityTitle: { fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
  guiaEntityRow: { flexDirection: 'row', marginBottom: 2 },
  guiaEntityLabel: { fontSize: 8, width: '25%' },
  guiaEntityValue: { fontSize: 8, width: '75%' },
  guiaFooterSection: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, alignItems: 'baseline' },
  signaturesBox: { flexDirection: 'row', width: '60%', justifyContent: 'space-around' },
  signatureLine: { flexDirection: 'column', alignItems: 'center', width: '45%' },
  line: { borderTopWidth: 1, borderTopColor: '#000', width: '100%', marginBottom: 3 },
  signatureText: { fontSize: 8 },
  obsRefBox: { width: '35%', flexDirection: 'column' },
  weightTotalRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', backgroundColor: '#d9d9d9' },
  weightTotalLabel: { width: '85%', textAlign: 'center', fontSize: 8, padding: 3, fontWeight: 'bold' },
  weightTotalValue: { width: '15%', textAlign: 'right', fontSize: 8, padding: 3 },
  tableColCodeGuia: { width: '15%', fontSize: 8 },
  tableColDescGuia: { width: '50%', fontSize: 8 },
  tableColUndGuia: { width: '10%', fontSize: 8, textAlign: 'center' },
  tableColQtyGuia: { width: '10%', fontSize: 8, textAlign: 'right' },
  tableColWeight: { width: '15%', fontSize: 8, textAlign: 'right' }
});

interface PdfDocumentProps {
  data: any;
  type: 'FACTURA' | 'BOLETA' | 'GUIA' | 'GUIA_CONSOLIDADA';
  companyInfo?: {
    name: string;
    ruc: string;
    address: string;
  };
}

// ---------------------------------------------------------------------------------
// Sub-components for clean factoring
// ---------------------------------------------------------------------------------

const ClientSection = ({ data }: { data: any }) => (
  <View style={styles.clientBox}>
    <View style={styles.clientCol1}>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>Señor(es):</Text>
        <Text style={styles.clientValue}>{data.client_name || 'Varios/Cliente Genérico'}</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>Dirección:</Text>
        <Text style={styles.clientValue}>{data.client_address || 'Dirección del cliente'}</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>RUC/DNI:</Text>
        <Text style={styles.clientValue}>{data.client_id || '00000000'}</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>Código:</Text>
        <Text style={styles.clientValue}>-</Text>
      </View>
    </View>
    <View style={styles.clientCol2}>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>F.Emisión:</Text>
        <Text style={styles.clientValue}>{new Date(data.created_at || data.date || Date.now()).toLocaleDateString()}</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>Condición:</Text>
        <Text style={styles.clientValue}>CONTADO</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>OC:</Text>
        <Text style={styles.clientValue}>-</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>Vendedor:</Text>
        <Text style={styles.clientValue}>{data.seller_name || 'VENDEDOR'}</Text>
      </View>
    </View>
  </View>
);

const ItemsTable = ({ data, isFactura }: { data: any, isFactura: boolean }) => (
  <View style={styles.tableBox}>
    <View style={styles.tableHeader}>
      <Text style={[styles.th, styles.colCod]}>Código</Text>
      <Text style={[styles.th, styles.colCant]}>Cant.</Text>
      <Text style={[styles.th, styles.colUm]}>U.M.</Text>
      <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
      <Text style={[styles.th, styles.colPu]}>P.U.</Text>
      {!isFactura && <Text style={[styles.th, styles.colDscto]}>Dscto</Text>}
      <Text style={[isFactura ? styles.thLast : styles.th, styles.colImporte]}>{isFactura ? 'Importe' : 'Importe Total'}</Text>
    </View>
    <View style={{ flex: 1 }}>
      {(data.items || []).map((item: any, i: number) => {
        const sku = item.product?.sku || item.product_id?.substring(0, 8) || item.sku || '001';
        // The data source often has just `name` from the joined cart object or `product.name`
        const name = item.product?.name || item.name || item.product_name || 'Producto';
        const qty = item.quantity || item.quantity_base || 0;
        const pu = item.unit_price || item.price || 0;
        const total = (qty * pu).toFixed(2);

        return (
          <View key={i} style={styles.tableRowItem}>
            <Text style={[styles.td, styles.colCod]}>{sku}</Text>
            <Text style={[styles.td, styles.colCant]}>{qty}</Text>
            <Text style={[styles.td, styles.colUm]}>NIU</Text>
            <Text style={[styles.td, styles.colDesc]}>{name}</Text>
            <Text style={[styles.td, styles.colPu]}>{pu.toFixed(2)}</Text>
            {!isFactura && <Text style={[styles.td, styles.colDscto]}>0.00</Text>}
            <Text style={[isFactura ? styles.tdLast : styles.td, styles.colImporte]}>{total}</Text>
          </View>
        );
      })}
    </View>
    
    {/* Son: Box */}
    <View style={styles.sonBox}>
      <Text style={styles.sonText}>{numberToWords(data.total || 0)}</Text>
      {!isFactura && (
         <View style={{ flexDirection: 'row' }}>
            <Text style={{ fontSize: 7, marginRight: 10, fontWeight: 'bold' }}>Total Dcmto: 0.00</Text>
            <Text style={{ fontSize: 7, fontWeight: 'bold' }}>S/ {(data.total || 0).toFixed(2)}</Text>
         </View>
      )}
    </View>
  </View>
);

const FacturaTemplate = ({ data, companyInfo }: { data: any, companyInfo: any }) => {
  const code = data.code || `${data.series || 'F001'}-${data.number || '000001'}`;
  const total = data.total || 0;
  const igv = total - (total / 1.18);
  const base = total / 1.18;

  return (
    <View style={styles.halfPage}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.logoBox}>
           <Text style={styles.logoText}>CUSCO</Text>
        </View>
        <View style={styles.companyCenter}>
          <Text style={styles.companyName}>{companyInfo.name}</Text>
          <Text style={styles.companyAddress}>{companyInfo.address}</Text>
        </View>
        <View style={styles.rucBox}>
          <Text style={styles.rucTop}>{companyInfo.ruc}</Text>
          <Text style={styles.rucMid}>FACTURA ELECTRÓNICA</Text>
          <Text style={styles.rucBot}>{code}</Text>
        </View>
      </View>

      <ClientSection data={data} />
      <ItemsTable data={data} isFactura={true} />

      {/* Totals Grid Factura */}
      <View style={styles.facturaTotalsContainer}>
        <View style={styles.qrBox}>
          <Text style={styles.qrText}>QR</Text>
        </View>
        <View style={styles.totalsGrid}>
          {/* Col 1 */}
          <View style={styles.totCol}>
             <View style={styles.totRowInner}>
                <View style={styles.totColHalf}>
                   <Text style={styles.totHeaderHalf}>Afecto</Text>
                   <Text style={styles.totVal}>{base.toFixed(2)}</Text>
                </View>
                <View style={styles.totColHalfLast}>
                   <Text style={styles.totHeaderHalf}>InAf./Exo.</Text>
                   <Text style={styles.totVal}>0.00</Text>
                </View>
             </View>
             <View style={[styles.totRowInner, { borderTopWidth: 1, borderTopColor: '#000' }]}>
                <View style={styles.totColHalf}>
                   <Text style={styles.totHeaderHalf}>Anticipo</Text>
                   <Text style={styles.totVal}>0.00</Text>
                </View>
                <View style={styles.totColHalfLast}>
                   <Text style={styles.totHeaderHalf}>ICBPER</Text>
                   <Text style={styles.totVal}>0.00</Text>
                </View>
             </View>
          </View>
          {/* Col 2 */}
          <View style={styles.totCol}>
             <View style={styles.totRowInner}>
                <View style={styles.totColHalf}>
                   <Text style={styles.totHeaderHalf}>ISC</Text>
                   <Text style={styles.totVal}>0.00</Text>
                </View>
                <View style={styles.totColHalfLast}>
                   <Text style={styles.totHeaderHalf}>IGV</Text>
                   <Text style={styles.totVal}>{igv.toFixed(2)}</Text>
                </View>
             </View>
             <View style={[styles.totRowInner, { borderTopWidth: 1, borderTopColor: '#000' }]}>
                <View style={styles.totColHalf}>
                   <Text style={styles.totHeaderHalf}>Total Dcmto</Text>
                   <Text style={styles.totVal}>0.00</Text>
                </View>
                <View style={styles.totColHalfLast}>
                   <Text style={styles.totHeaderHalf}>Percepción</Text>
                   <Text style={styles.totVal}>0.00</Text>
                </View>
             </View>
          </View>
          {/* Col 3 */}
          <View style={styles.totCol}>
             <View style={styles.totColHalfLast}>
                <Text style={styles.totHeaderHalf}>Total Dscto</Text>
                <Text style={styles.totVal}>0.00</Text>
             </View>
             <View style={[styles.totColHalfLast, { borderTopWidth: 1, borderTopColor: '#000' }]}>
                <Text style={styles.totHeaderHalf}>Total a Pagar</Text>
                <Text style={styles.totVal}>{total.toFixed(2)}</Text>
             </View>
          </View>
        </View>
      </View>

      <Text style={styles.legalText}>
        Representación impresa del comprobante de pago electrónico. Este documento puede ser consultado en sistema. Precios más Bajos
      </Text>
    </View>
  );
};

const BoletaTemplate = ({ data, companyInfo }: { data: any, companyInfo: any }) => {
  const code = data.code || `${data.series || 'B001'}-${data.number || '000001'}`;
  
  return (
    <View style={{ flex: 1, flexDirection: 'column', height: '48%', justifyContent: 'space-between' }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginBottom: 10 }]}>
        <View style={[styles.logoBox, { width: 50, height: 40 }]}>
           <Text style={[styles.logoText, { fontSize: 10 }]}>CUSCO</Text>
        </View>
        <View style={styles.companyCenter}>
          <Text style={[styles.companyName, { fontSize: 14 }]}>{companyInfo.name}</Text>
          <Text style={[styles.companyAddress, { fontSize: 8 }]}>{companyInfo.address}</Text>
        </View>
        <View style={[styles.rucBox, { width: 170, padding: 5 }]}>
          <Text style={[styles.rucTop, { fontSize: 11 }]}>{companyInfo.ruc}</Text>
          <Text style={[styles.rucMid, { fontSize: 9, marginVertical: 3 }]}>BOLETA DE VENTA ELECTRÓNICA</Text>
          <Text style={[styles.rucBot, { fontSize: 11 }]}>{code}</Text>
        </View>
      </View>

      <ClientSection data={data} />
      <ItemsTable data={data} isFactura={false} />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
        <View style={[styles.qrBox, { width: 40, height: 35 }]}>
           <Text style={styles.qrText}>QR CODE</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.legalText, { marginTop: 0 }]}>
            Representación impresa del comprobante de pago electrónico.
            Este documento puede ser consultado de manera digital.
          </Text>
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------------

export const PdfDocument: React.FC<PdfDocumentProps> = ({ data, type, companyInfo }) => {
  const cInfo = companyInfo || {
    name: 'CUSCO BRANDS S.A.C.',
    ruc: '20606286326',
    address: 'MZA. C LOTE. 1 URB. PARQUE INDUSTRIAL CUSCO - CUSCO - CUSCO'
  };

  const isGuia = type.includes('GUIA');

  if (type === 'FACTURA') {
    return (
      <Document>
        <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
          <FacturaTemplate data={data} companyInfo={cInfo} />
          <FacturaTemplate data={data} companyInfo={cInfo} />
        </Page>
      </Document>
    );
  }

  if (type === 'BOLETA') {
    return (
      <Document>
        <Page size="A4" orientation="portrait" style={{...styles.pagePortrait, padding: 15}}>
          <BoletaTemplate data={data} companyInfo={cInfo} />
          {/* Divisor line between the two copies */}
          <View style={{ borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: '#ccc', marginVertical: 10 }} />
          <BoletaTemplate data={data} companyInfo={cInfo} />
        </Page>
      </Document>
    );
  }

  // GUIA LOGIC
  const code = data.code || `${data.series || 'T001'}-${data.number || '000001'}`;
  return (
    <Document>
      <Page size="A4" style={styles.pagePortrait}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.companyCenter}>
            <Text style={styles.companyName}>{cInfo.name}</Text>
            <Text style={styles.companyAddress}>{cInfo.address}</Text>
          </View>
          <View style={styles.rucBox}>
            <Text style={styles.rucTop}>RUC: {cInfo.ruc}</Text>
            <Text style={styles.rucMid}>{type === 'GUIA_CONSOLIDADA' ? 'GUIA REMISION CONSOLIDADA' : 'GUIA REMISION REMITENTE'}</Text>
            <Text style={styles.rucBot}>{code}</Text>
          </View>
        </View>

        {/* Guia Metadata */}
        <View style={styles.guiaInfoSection}>
          <View style={styles.guiaInfoRow}>
            <Text style={styles.guiaInfoLabel}>Fecha Inicio de Traslado:</Text>
            <Text style={styles.guiaInfoValue}>{new Date(data.created_at || data.date || Date.now()).toLocaleDateString()}</Text>
          </View>
          <View style={styles.guiaInfoRow}>
            <Text style={styles.guiaInfoLabel}>Punto de Partida:</Text>
            <Text style={styles.guiaInfoValue}>(080101) {cInfo.address}</Text>
          </View>
          <View style={styles.guiaInfoRow}>
            <Text style={styles.guiaInfoLabel}>Punto de Llegada:</Text>
            <Text style={styles.guiaInfoValue}>(000000) {type.includes('CONSOLIDADA') ? 'Ruta Local' : (data.delivery_address || 'Dirección del cliente')}</Text>
          </View>
        </View>

        <View style={styles.guiaEntitiesSection}>
          <View style={styles.guiaEntityBox}>
            <Text style={styles.guiaEntityTitle}>DATOS DEL DESTINATARIO</Text>
            <View style={styles.guiaEntityRow}>
              <Text style={styles.guiaEntityLabel}>Señores:</Text>
              <Text style={styles.guiaEntityValue}>{data.client_name || 'Varios / Petición del Emisor'}</Text>
            </View>
            <View style={styles.guiaEntityRow}>
              <Text style={styles.guiaEntityLabel}>R.U.C.:</Text>
              <Text style={styles.guiaEntityValue}>{data.client_id || '00000000'}</Text>
            </View>
          </View>
          <View style={styles.guiaEntityBox}>
            <Text style={styles.guiaEntityTitle}>DATOS DEL TRANSPORTISTA</Text>
            <View style={styles.guiaEntityRow}>
              <Text style={styles.guiaEntityLabel}>Razón Social:</Text>
              <Text style={styles.guiaEntityValue}>PROPIO</Text>
            </View>
          </View>
        </View>

        {/* ITEMS TABLE FOR GUIA */}
        <View style={styles.tableBox}>
          <View style={[styles.tableHeader, { backgroundColor: '#cce0ff' }]}>
            <Text style={[styles.th, styles.tableColCodeGuia]}>CÓDIGO</Text>
            <Text style={[styles.th, styles.tableColQtyGuia]}>CANT.</Text>
            <Text style={[styles.th, styles.tableColUndGuia]}>UNI.</Text>
            <Text style={[styles.th, styles.tableColDescGuia]}>DESCRIPCIÓN</Text>
            <Text style={[styles.th, styles.tableColWeight]}>PESO</Text>
          </View>
          {(data.items || []).map((item: any, i: number) => {
             const sku = item.product?.sku || item.product_id?.substring(0,8) || item.sku || '001';
             const name = item.product?.name || item.name;
             const qty = item.quantity || item.quantity_base || 0;
             return (
                <View key={i} style={styles.tableRowItem}>
                  <Text style={[styles.td, styles.tableColCodeGuia]}>{sku}</Text>
                  <Text style={[styles.td, styles.tableColQtyGuia]}>{qty}</Text>
                  <Text style={[styles.td, styles.tableColUndGuia]}>NIU</Text>
                  <Text style={[styles.td, styles.tableColDescGuia]}>{name}</Text>
                  <Text style={[styles.td, styles.tableColWeight]}>{(qty * 0.5).toFixed(2)}</Text>
                </View>
             );
          })}
          <View style={styles.weightTotalRow}>
             <Text style={styles.weightTotalLabel}>PESO TOTAL KG</Text>
             <Text style={styles.weightTotalValue}>0.00</Text>
          </View>
        </View>

        <View style={styles.guiaFooterSection}>
           <View style={styles.obsRefBox}></View>
           <View style={styles.signaturesBox}>
              <View style={styles.signatureLine}>
                 <View style={styles.line}></View>
                 <Text style={styles.signatureText}>DESPACHADO POR</Text>
              </View>
              <View style={styles.signatureLine}>
                 <View style={styles.line}></View>
                 <Text style={styles.signatureText}>RECIBÍ CONFORME</Text>
              </View>
           </View>
           <View style={styles.obsRefBox}></View>
        </View>

      </Page>
    </Document>
  );
};
