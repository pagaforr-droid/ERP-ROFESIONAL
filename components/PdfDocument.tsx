import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts if needed, otherwise rely on standard ones
// Font.register({ family: 'Roboto', src: 'path_to_roboto' });

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 10,
  },
  companyInfo: {
    flexDirection: 'column',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 10,
    color: '#333',
  },
  documentInfo: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#000',
    padding: 10,
    borderRadius: 5,
  },
  documentRuc: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    backgroundColor: '#f0f0f0',
    padding: 5,
    textAlign: 'center',
    width: '100%',
  },
  documentNumber: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  clientSection: {
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 5,
  },
  clientRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  clientLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    width: 100,
  },
  clientValue: {
    fontSize: 10,
  },
  table: {
    flexDirection: 'column',
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    padding: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    padding: 5,
  },
  tableColCode: { width: '15%', fontSize: 9 },
  tableColDesc: { width: '50%', fontSize: 9 },
  tableColUnd: { width: '10%', fontSize: 9 },
  tableColQty: { width: '10%', fontSize: 9, textAlign: 'right' },
  tableColPrice: { width: '15%', fontSize: 9, textAlign: 'right' },
  
  tableColQtyOnly: { width: '25%', fontSize: 9, textAlign: 'right' },

  tableColWeight: { width: '15%', fontSize: 8, textAlign: 'right' },
  tableColDescGuia: { width: '50%', fontSize: 8 },
  tableColUndGuia: { width: '10%', fontSize: 8, textAlign: 'center' },
  tableColQtyGuia: { width: '10%', fontSize: 8, textAlign: 'right' },
  tableColCodeGuia: { width: '15%', fontSize: 8 },

  weightTotalRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    backgroundColor: '#d9d9d9',
  },
  weightTotalLabel: {
    width: '85%',
    textAlign: 'center',
    fontSize: 8,
    padding: 3,
    fontWeight: 'bold',
  },
  weightTotalValue: {
    width: '15%',
    textAlign: 'right',
    fontSize: 8,
    padding: 3,
  },

  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  totalsBox: {
    width: 200,
    borderWidth: 1,
    borderColor: '#000',
    padding: 5,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalsValue: {
    fontSize: 10,
  },
  
  guiaInfoSection: {
    flexDirection: 'column',
    marginBottom: 5,
  },
  guiaInfoRow: {
    flexDirection: 'row',
    marginBottom: 3,
    alignItems: 'flex-start',
  },
  guiaInfoLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    width: '18%',
  },
  guiaInfoValue: {
    fontSize: 8,
    width: '82%',
  },
  guiaEntitiesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  guiaEntityBox: {
    width: '49%',
    flexDirection: 'column',
  },
  guiaEntityTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  guiaEntityRow: {
    flexDirection: 'row',
    marginBottom: 2,
    alignItems: 'flex-start',
  },
  guiaEntityLabel: {
    fontSize: 8,
    width: '25%',
  },
  guiaEntityValue: {
    fontSize: 8,
    width: '75%',
  },
  guiaFooterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    alignItems: 'baseline'
  },
  signaturesBox: {
    flexDirection: 'row',
    width: '60%',
    justifyContent: 'space-around'
  },
  signatureLine: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '45%'
  },
  line: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: '100%',
    marginBottom: 3
  },
  signatureText: {
    fontSize: 8,
  },
  obsRefBox: {
    width: '35%',
    flexDirection: 'column'
  },
  sunatHash: {
    marginTop: 30,
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
  },
  footerText: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 8,
    textAlign: 'center',
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 5,
  }
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

export const PdfDocument: React.FC<PdfDocumentProps> = ({ data, type, companyInfo }) => {
  const getDocumentTitle = () => {
    switch(type) {
      case 'FACTURA': return 'FACTURA ELECTRÓNICA';
      case 'BOLETA': return 'BOLETA DE VENTA ELECTRÓNICA';
      case 'GUIA': return 'GUIA REMISION REMITENTE\nELECTRONICA';
      case 'GUIA_CONSOLIDADA': return 'GUIA REMISION CONSOLIDADA\nELECTRONICA (INTERNA)';
      default: return 'DOCUMENTO';
    }
  };

  const cInfo = companyInfo || {
    name: 'EMPRESA DEMO S.A.C.',
    ruc: '20123456789',
    address: 'Av. Principal 123, Lima, Perú'
  };

  const code = data.code || `${data.series || 'F001'}-${data.number || '000001'}`;
  const isGuia = type.includes('GUIA');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{cInfo.name}</Text>
            <Text style={styles.companyDetails}>{cInfo.address}</Text>
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentRuc}>RUC: {cInfo.ruc}</Text>
            <Text style={styles.documentTitle}>{getDocumentTitle()}</Text>
            <Text style={styles.documentNumber}>{code}</Text>
          </View>
        </View>

        {/* DOCUMENT METADATA */}
        {!isGuia ? (
          <View style={styles.clientSection}>
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Cliente:</Text>
              <Text style={styles.clientValue}>{data.client_name || 'Varios/Cliente Genérico'}</Text>
            </View>
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Fecha de Emisión:</Text>
              <Text style={styles.clientValue}>{new Date(data.created_at || data.date || Date.now()).toLocaleDateString()}</Text>
            </View>
          </View>
        ) : (
          <>
            {/* GUÍA META INFO */}
            <View style={styles.guiaInfoSection}>
              <View style={styles.guiaInfoRow}>
                <Text style={styles.guiaInfoLabel}>Fecha Inicio de Traslado:</Text>
                <Text style={styles.guiaInfoValue}>{new Date(data.created_at || data.date || Date.now()).toLocaleDateString()}      <Text style={{fontWeight: 'bold'}}>Costo Mínimo de Traslado:</Text> 0.00</Text>
              </View>
              <View style={styles.guiaInfoRow}>
                <Text style={styles.guiaInfoLabel}>Punto de Partida:</Text>
                <Text style={styles.guiaInfoValue}>(080101) {cInfo.address}</Text>
              </View>
              <View style={styles.guiaInfoRow}>
                <Text style={styles.guiaInfoLabel}>Punto de Llegada:</Text>
                <Text style={styles.guiaInfoValue}>(000000) {type.includes('CONSOLIDADA') ? 'Multiples Puntos de Entrega (Ruta)' : (data.delivery_address || 'Dirección del cliente')}</Text>
              </View>
            </View>

            {/* GUIA ENTITIES */}
            <View style={styles.guiaEntitiesSection}>
              <View style={styles.guiaEntityBox}>
                <Text style={styles.guiaEntityTitle}>DATOS DEL DESTINATARIO</Text>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>Señores:</Text>
                  <Text style={styles.guiaEntityValue}>{data.client_name || 'Varios / Petición del Emisor'}</Text>
                </View>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>Dirección:</Text>
                  <Text style={styles.guiaEntityValue}>{type.includes('CONSOLIDADA') ? 'Consolidado' : (data.delivery_address || 'Dirección del cliente')}</Text>
                </View>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>R.U.C.:</Text>
                  <Text style={styles.guiaEntityValue}>{data.client_id?.length === 11 ? data.client_id : '00000000000'}   <Text style={{fontWeight: 'bold'}}>Fecha:</Text> {new Date(data.created_at || data.date || Date.now()).toLocaleDateString()}</Text>
                </View>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>Motivo:</Text>
                  <Text style={styles.guiaEntityValue}>{data.motivo || 'Venta'}</Text>
                </View>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>Doc. Ref.:</Text>
                  <Text style={styles.guiaEntityValue}>{data.ref_doc || '-'}</Text>
                </View>
              </View>

              <View style={styles.guiaEntityBox}>
                <Text style={styles.guiaEntityTitle}>DATOS DEL TRANSPORTISTA</Text>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>Razón Social:</Text>
                  <Text style={styles.guiaEntityValue}>{data.guide_transporter_id ? `TRANSPORTES ${data.guide_transporter_id.substring(0,8)}` : 'TRANSPORTE PROPIO'}</Text>
                </View>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>R.U.C.:</Text>
                  <Text style={styles.guiaEntityValue}>10000000000</Text>
                </View>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>M. Unidad:</Text>
                  <Text style={styles.guiaEntityValue}>{data.guide_vehicle_id || 'VEH-DEFAULT'}</Text>
                </View>
                <View style={styles.guiaEntityRow}>
                  <Text style={styles.guiaEntityLabel}>Placa / Lic.:</Text>
                  <Text style={styles.guiaEntityValue}>{data.guide_vehicle_id || 'V-001'}  /  {data.guide_driver_id || 'L-0000'}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ITEMS TABLE */}
        <View style={styles.table}>
          <View style={[styles.tableHeaderRow, { backgroundColor: isGuia ? '#cce0ff' : '#f0f0f0' }]}>
            <Text style={isGuia ? styles.tableColCodeGuia : styles.tableColCode}>CÓDIGO</Text>
            {isGuia ? null : <Text style={styles.tableColDesc}>DESCRIPCIÓN</Text>}
            <Text style={isGuia ? styles.tableColQtyGuia : styles.tableColQty}>{isGuia ? 'CANT.' : 'CANT.'}</Text>
            <Text style={isGuia ? styles.tableColUndGuia : styles.tableColUnd}>{isGuia ? 'UNI.' : 'UND'}</Text>
            {isGuia ? <Text style={styles.tableColDescGuia}>DESCRIPCIÓN</Text> : null}
            {!isGuia && <Text style={styles.tableColPrice}>TOTAL (S/)</Text>}
            {isGuia && <Text style={styles.tableColWeight}>PESO</Text>}
          </View>
          
          {(data.items || []).map((item: any, i: number) => {
             const sku = item.product?.sku || item.product_id?.substring(0,8) || item.sku || '001';
             const name = item.product?.name || item.name || 'Producto Desconocido';
             const qty = item.quantity || item.quantity_base || 0;
             const price = (qty * (item.unit_price || item.price || 0)).toFixed(2);
             
             // Weight approx 0.5kg per unit if unknown.
             const itemWeight = (qty * 0.5).toFixed(2);

             if (isGuia) {
               return (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.tableColCodeGuia}>{sku}</Text>
                    <Text style={styles.tableColQtyGuia}>{qty.toFixed(3)}</Text>
                    <Text style={styles.tableColUndGuia}>NIU</Text>
                    <Text style={styles.tableColDescGuia}>{name}</Text>
                    <Text style={styles.tableColWeight}>{itemWeight}</Text>
                  </View>
               );
             }

             return (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableColCode}>{sku}</Text>
                <Text style={styles.tableColDesc}>{name}</Text>
                <Text style={styles.tableColUnd}>NIU</Text>
                <Text style={styles.tableColQty}>{qty}</Text>
                <Text style={styles.tableColPrice}>{price}</Text>
              </View>
             );
          })}
          
          {/* GUIA TOTAL WEIGHT FOOTER */}
          {isGuia && (
            <View style={styles.weightTotalRow}>
               <Text style={styles.weightTotalLabel}>PESO TOTAL KG</Text>
               <Text style={styles.weightTotalValue}>
                  {((data.items || []).reduce((acc: number, item: any) => acc + ((item.quantity || item.quantity_base || 0) * 0.5), 0)).toFixed(2)}
               </Text>
            </View>
          )}
        </View>

        {/* TOTALS (Only for Sales) */}
        {!isGuia && (
          <View style={styles.totalsSection}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>SUBTOTAL:</Text>
                <Text style={styles.totalsValue}>{(data.total / 1.18).toFixed(2)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>IGV (18%):</Text>
                <Text style={styles.totalsValue}>{(data.total - (data.total / 1.18)).toFixed(2)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>TOTAL A PAGAR:</Text>
                <Text style={styles.totalsValue}>{data.total?.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* GUIA FOOTER TEXTS & SIGNATURES */}
        {isGuia && (
           <View style={styles.guiaFooterSection}>
             <View style={styles.obsRefBox}>
                <Text style={{fontSize: 8, marginBottom: 5}}>Observación: {data.notes || ''}</Text>
                <View style={{height: 50, width: 50, backgroundColor: '#eee', borderWidth: 1, borderColor: '#ccc', justifyContent:'center', alignItems:'center'}}>
                   <Text style={{fontSize: 6}}>QR CODE</Text>
                </View>
             </View>
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
             <View style={styles.obsRefBox}>
                <Text style={{fontSize: 8, fontWeight: 'bold'}}>Nombre:</Text>
                <Text style={{fontSize: 8, marginTop: 4, fontWeight: 'bold'}}>D.N.I.:</Text>
             </View>
           </View>
        )}

        {/* HASH / LEGAL */}
        {!type.includes('CONSOLIDADA') && (
          <Text style={styles.sunatHash}>
            Representación impresa del documento electrónico.
            {data.sunat_status === 'ACCEPTED' ? ' Comprobante aceptado por SUNAT.' : ' En proceso de envío.'}
          </Text>
        )}

        <Text style={styles.footerText}>Generado por Traceflow ERP</Text>
      </Page>
    </Document>
  );
};
