import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image as PdfImage } from '@react-pdf/renderer';
import { numberToWords } from '../utils/numberToWords';

const styles = StyleSheet.create({
  pagePortrait: { flexDirection: 'column', backgroundColor: '#ffffff', padding: 20, fontFamily: 'Helvetica' },
  pageLandscape: { flexDirection: 'row', backgroundColor: '#ffffff', padding: 20, fontFamily: 'Helvetica', justifyContent: 'space-between' },
  halfPage: { width: '48%', height: '100%', flexDirection: 'column' },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  logoBox: { width: 50, height: 40, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  logoImage: { width: '100%', height: '100%', objectFit: 'contain' },
  logoText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
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
  colUm: { width: '10%', textAlign: 'center' },
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
  facturaTotalsContainer: { flexDirection: 'row', borderWidth: 1, borderColor: '#000', marginTop: 4, height: 45 },
  
  // Modificado: Ahora el contenedor del QR usa flex column para permitir la alerta debajo
  qrSection: { width: 50, borderRightWidth: 1, borderRightColor: '#000', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  qrBox: { width: 35, height: 35, margin: 1, borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
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

  // GUIA STYLES
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
  data: any | any[];
  type?: 'FACTURA' | 'BOLETA' | 'GUIA' | 'GUIA_CONSOLIDADA' | 'BATCH' | 'BOLETA_PAGO' | string;
  companyInfo?: { name: string; ruc: string; address: string; logo_url?: string };
}

const LogoComponent = ({ url, defaultName }: { url?: string, defaultName: string }) => (
    <View style={styles.logoBox}>
        {url ? (
            <PdfImage source={{ uri: url, method: 'GET', headers: { 'Cache-Control': 'no-cache' } }} style={styles.logoImage} />
        ) : (
            <Text style={styles.logoText}>{defaultName.substring(0, 8)}</Text>
        )}
    </View>
);

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
        <Text style={styles.clientValue}>{data.client_ruc || '00000000'}</Text>
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
        <Text style={styles.clientValue}>{data.payment_method || 'CONTADO'}</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>OC:</Text>
        <Text style={styles.clientValue}>-</Text>
      </View>
      <View style={styles.clientRowInfo}>
        <Text style={styles.clientLabel}>Vendedor:</Text>
        <Text style={styles.clientValue}>{data.seller_name || 'VENDEDOR ASIGNADO'}</Text>
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
        const sku = item.product?.sku || item.product_id?.substring(0, 8) || item.product_sku || item.sku || '001';
        const name = item.product?.name || item.name || item.product_name || 'Producto';
        const qty = item.quantity_presentation ?? item.quantity ?? item.quantity_base ?? 0;
        const pu = item.unit_price ?? item.price ?? 0;
        const total = item.total_price !== undefined ? Number(item.total_price).toFixed(2) : (qty * pu).toFixed(2);
        
        // CORRECCIÓN MAGISTRAL: "CAJAx12", "BOTx1"
        // Determina si se vendió en Empaque o Unidad Base
        const isPkg = item.selected_unit === item.product?.package_type || item.selected_unit === 'CJA' || item.selected_unit === 'PKG';
        const content = isPkg ? (item.product?.package_content || 1) : 1;
        const shortUnit = (item.selected_unit || 'UND').substring(0, 4).toUpperCase();
        const formattedUm = `${shortUnit}x${content}`;

        return (
          <View key={i} style={styles.tableRowItem}>
            <Text style={[styles.td, styles.colCod]}>{sku}</Text>
            <Text style={[styles.td, styles.colCant]}>{qty}</Text>
            <Text style={[styles.td, styles.colUm]}>{formattedUm}</Text>
            <Text style={[styles.td, styles.colDesc]}>{name}</Text>
            <Text style={[styles.td, styles.colPu]}>{Number(pu).toFixed(2)}</Text>
            {!isFactura && <Text style={[styles.td, styles.colDscto]}>0.00</Text>}
            <Text style={[isFactura ? styles.tdLast : styles.td, styles.colImporte]}>{total}</Text>
          </View>
        );
      })}
    </View>
    
    <View style={styles.sonBox}>
      <Text style={styles.sonText}>{numberToWords(data.total || 0)}</Text>
      {!isFactura && (
         <View style={{ flexDirection: 'row' }}>
            <Text style={{ fontSize: 7, marginRight: 10, fontWeight: 'bold' }}>Total Dcmto: 0.00</Text>
            <Text style={{ fontSize: 7, fontWeight: 'bold' }}>S/ {Number(data.total || 0).toFixed(2)}</Text>
         </View>
      )}
    </View>
  </View>
);

const FacturaTemplate = ({ data, companyInfo, isNotaCredito = false }: { data: any, companyInfo: any, isNotaCredito?: boolean }) => {
  const code = data.code || `${data.series || 'F001'}-${data.number || '00000000'}`;
  const total = Number(data.total || 0);
  const igv = total - (total / 1.18);
  const base = total / 1.18;
  const balanceDue = Number(data.previous_debt || 0);

  return (
    <View style={styles.halfPage}>
      <View style={styles.headerRow}>
        <LogoComponent url={companyInfo.logo_url} defaultName={companyInfo.name} />
        
        <View style={styles.companyCenter}>
          <Text style={styles.companyName}>{companyInfo.name || 'EMPRESA DEMO S.A.C.'}</Text>
          <Text style={styles.companyAddress}>{companyInfo.address || 'Dirección de la Empresa'}</Text>
        </View>
        
        <View style={styles.rucBox}>
          <Text style={styles.rucTop}>RUC {companyInfo.ruc || '20000000001'}</Text>
          <Text style={styles.rucMid}>{isNotaCredito ? 'NOTA DE CRÉDITO ELECTRÓNICA' : 'FACTURA ELECTRÓNICA'}</Text>
          <Text style={styles.rucBot}>{code}</Text>
        </View>
      </View>

      <ClientSection data={data} />
      <ItemsTable data={data} isFactura={true} />

      <View style={styles.facturaTotalsContainer}>
        
        {/* CORRECCIÓN: ALERTA DE DEUDA EN LA CAJA DEL QR */}
        <View style={styles.qrSection}>
           <View style={styles.qrBox}><Text style={styles.qrText}>QR</Text></View>
           {balanceDue > 0 && (
             <Text style={{ fontSize: 4, fontWeight: 'bold', color: '#000', textAlign: 'center', marginTop: 1 }}>
               CTA. ANT.{'\n'}S/ {balanceDue.toFixed(2)}
             </Text>
           )}
        </View>

        <View style={styles.totalsGrid}>
          <View style={styles.totCol}>
             <View style={styles.totRowInner}>
                <View style={styles.totColHalf}><Text style={styles.totHeaderHalf}>Afecto</Text><Text style={styles.totVal}>{base.toFixed(2)}</Text></View>
                <View style={styles.totColHalfLast}><Text style={styles.totHeaderHalf}>InAf./Exo.</Text><Text style={styles.totVal}>0.00</Text></View>
             </View>
             <View style={[styles.totRowInner, { borderTopWidth: 1, borderTopColor: '#000' }]}>
                <View style={styles.totColHalf}><Text style={styles.totHeaderHalf}>Anticipo</Text><Text style={styles.totVal}>0.00</Text></View>
                <View style={styles.totColHalfLast}><Text style={styles.totHeaderHalf}>ICBPER</Text><Text style={styles.totVal}>0.00</Text></View>
             </View>
          </View>
          <View style={styles.totCol}>
             <View style={styles.totRowInner}>
                <View style={styles.totColHalf}><Text style={styles.totHeaderHalf}>ISC</Text><Text style={styles.totVal}>0.00</Text></View>
                <View style={styles.totColHalfLast}><Text style={styles.totHeaderHalf}>IGV</Text><Text style={styles.totVal}>{igv.toFixed(2)}</Text></View>
             </View>
             <View style={[styles.totRowInner, { borderTopWidth: 1, borderTopColor: '#000' }]}>
                <View style={styles.totColHalf}><Text style={styles.totHeaderHalf}>Total Dcmto</Text><Text style={styles.totVal}>0.00</Text></View>
                <View style={styles.totColHalfLast}><Text style={styles.totHeaderHalf}>Percepción</Text><Text style={styles.totVal}>0.00</Text></View>
             </View>
          </View>
          <View style={styles.totCol}>
             <View style={styles.totColHalfLast}><Text style={styles.totHeaderHalf}>Total Dscto</Text><Text style={styles.totVal}>0.00</Text></View>
             <View style={[styles.totColHalfLast, { borderTopWidth: 1, borderTopColor: '#000' }]}><Text style={styles.totHeaderHalf}>Total a Pagar</Text><Text style={styles.totVal}>{total.toFixed(2)}</Text></View>
          </View>
        </View>
      </View>

      <Text style={styles.legalText}>Representación impresa del comprobante de pago electrónico. Tandao ERP®</Text>
    </View>
  );
};

const BoletaTemplate = ({ data, companyInfo, isNotaCredito = false }: { data: any, companyInfo: any, isNotaCredito?: boolean }) => {
  const code = data.code || `${data.series || 'B001'}-${data.number || '00000000'}`;
  const balanceDue = Number(data.previous_debt || 0);

  return (
    <View style={{ flex: 1, flexDirection: 'column', height: '48%', justifyContent: 'space-between' }}>
      <View style={[styles.headerRow, { marginBottom: 10 }]}>
        <LogoComponent url={companyInfo.logo_url} defaultName={companyInfo.name} />
        
        <View style={styles.companyCenter}>
          <Text style={[styles.companyName, { fontSize: 14 }]}>{companyInfo.name || 'EMPRESA DEMO S.A.C.'}</Text>
          <Text style={[styles.companyAddress, { fontSize: 8 }]}>{companyInfo.address || 'Dirección de la Empresa'}</Text>
        </View>
        
        <View style={[styles.rucBox, { width: 170, padding: 5 }]}>
          <Text style={[styles.rucTop, { fontSize: 11 }]}>RUC {companyInfo.ruc || '20000000001'}</Text>
          <Text style={[styles.rucMid, { fontSize: 9, marginVertical: 3 }]}>{isNotaCredito ? 'NOTA DE CRÉDITO ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}</Text>
          <Text style={[styles.rucBot, { fontSize: 11 }]}>{code}</Text>
        </View>
      </View>
      <ClientSection data={data} />
      <ItemsTable data={data} isFactura={false} />
      
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
        <View style={{ flexDirection: 'column', alignItems: 'center' }}>
           <View style={[styles.qrBox, { width: 40, height: 35 }]}><Text style={styles.qrText}>QR CODE</Text></View>
           {/* CORRECCIÓN: ALERTA DE DEUDA EN BOLETA */}
           {balanceDue > 0 && (
             <Text style={{ fontSize: 5, fontWeight: 'bold', color: '#000', textAlign: 'center', marginTop: 1 }}>
               CTA. ANT. S/ {balanceDue.toFixed(2)}
             </Text>
           )}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={[styles.legalText, { marginTop: 0 }]}>Representación impresa del comprobante de pago electrónico.</Text></View>
      </View>
    </View>
  );
};

const BoletaPagoTemplate = ({ data, companyInfo }: { data: any, companyInfo: any }) => {
  const emp = data.employee || {};
  return (
    <View style={{ flex: 1, flexDirection: 'column', height: '48%', justifyContent: 'space-between', padding: 5 }}>
      {/* ... (Boleta Pago) */}
    </View>
  );
};

const GuiaTemplate = ({ data, companyInfo, type }: { data: any, companyInfo: any, type: string }) => {
  const code = data.code || `${data.series || 'T001'}-${data.number || '00000000'}`;
  return (
    <>
      <View style={styles.headerRow}>
        <View style={styles.companyCenter}>
          <Text style={styles.companyName}>{companyInfo.name || 'EMPRESA DEMO S.A.C.'}</Text>
          <Text style={styles.companyAddress}>{companyInfo.address || 'Dirección de la Empresa'}</Text>
        </View>
        <View style={styles.rucBox}>
          <Text style={styles.rucTop}>RUC {companyInfo.ruc || '20000000001'}</Text>
          <Text style={styles.rucMid}>{type === 'GUIA_CONSOLIDADA' ? 'GUIA REMISION CONSOLIDADA' : 'GUIA REMISION REMITENTE'}</Text>
          <Text style={styles.rucBot}>{code}</Text>
        </View>
      </View>
      <View style={styles.guiaInfoSection}>
         <View style={styles.guiaInfoRow}>
          <Text style={styles.guiaInfoLabel}>Fecha Inicio de Traslado:</Text>
          <Text style={styles.guiaInfoValue}>{new Date(data.created_at || data.date || Date.now()).toLocaleDateString()}</Text>
        </View>
        <View style={styles.guiaInfoRow}>
          <Text style={styles.guiaInfoLabel}>Punto de Partida:</Text>
          <Text style={styles.guiaInfoValue}>(080101) {companyInfo.address}</Text>
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
            <Text style={styles.guiaEntityValue}>{data.client_ruc || data.client_id || '00000000'}</Text>
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
           const name = item.product?.name || item.name || item.product_name || 'Producto';
           const qty = item.quantity_presentation ?? item.quantity ?? item.quantity_base ?? 0;
           
           // Formato dinámico para la guía
           const isPkg = item.selected_unit === item.product?.package_type || item.selected_unit === 'CJA' || item.selected_unit === 'PKG';
           const content = isPkg ? (item.product?.package_content || 1) : 1;
           const shortUnit = (item.selected_unit || 'UND').substring(0, 4).toUpperCase();
           const formattedUm = `${shortUnit}x${content}`;

           return (
              <View key={i} style={styles.tableRowItem}>
                <Text style={[styles.td, styles.tableColCodeGuia]}>{sku}</Text>
                <Text style={[styles.td, styles.tableColQtyGuia]}>{qty}</Text>
                <Text style={[styles.td, styles.tableColUndGuia]}>{formattedUm}</Text>
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
    </>
  );
};

export const PdfDocument: React.FC<PdfDocumentProps> = ({ data, type, companyInfo }) => {
  const cInfo = companyInfo || {
    name: 'EMPRESA DEMO S.A.C.',
    ruc: '20000000001',
    address: 'Dirección no configurada',
    logo_url: ''
  };

  const items = Array.isArray(data) ? data : [data];

  return (
    <Document>
      {items.map((doc: any, index: number) => {
        const docType = doc._isGuia ? (doc.type === 'GUIA_CONSOLIDADA' ? 'GUIA_CONSOLIDADA' : 'GUIA') : (doc.document_type || type || 'FACTURA');
        const isNotaCredito = docType === 'NOTA DE CREDITO' || docType === 'NOTA_CREDITO';
        const isFacturaFormat = docType === 'FACTURA' || (isNotaCredito && doc.series && doc.series.startsWith('F'));
        const isBoletaFormat = docType === 'BOLETA' || (isNotaCredito && doc.series && doc.series.startsWith('B'));

        if (isFacturaFormat || (isNotaCredito && !isBoletaFormat)) {
          return (
            <Page key={index} size="A4" orientation="landscape" style={styles.pageLandscape}>
              <FacturaTemplate data={doc} companyInfo={cInfo} isNotaCredito={isNotaCredito} />
              <FacturaTemplate data={doc} companyInfo={cInfo} isNotaCredito={isNotaCredito} />
            </Page>
          );
        }
        if (isBoletaFormat) {
          return (
            <Page key={index} size="A4" orientation="portrait" style={{...styles.pagePortrait, padding: 15}}>
              <BoletaTemplate data={doc} companyInfo={cInfo} isNotaCredito={isNotaCredito} />
              <View style={{ borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: '#ccc', marginVertical: 10 }} />
              <BoletaTemplate data={doc} companyInfo={cInfo} isNotaCredito={isNotaCredito} />
            </Page>
          );
        }
        if (docType === 'BOLETA_PAGO' || doc._isBoletaPago) {
           return (
             <Page key={index} size="A4" orientation="portrait" style={{...styles.pagePortrait, padding: 15}}>
               <BoletaPagoTemplate data={doc} companyInfo={cInfo} />
               <View style={{ borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: '#ccc', marginVertical: 10 }} />
               <BoletaPagoTemplate data={doc} companyInfo={cInfo} />
             </Page>
           );
        }
        return (
          <Page key={index} size="A4" style={styles.pagePortrait}>
            <GuiaTemplate data={doc} companyInfo={cInfo} type={docType} />
          </Page>
        );
      })}
    </Document>
  );
};
