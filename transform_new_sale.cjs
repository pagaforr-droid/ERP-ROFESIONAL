const fs = require('fs');
let code = fs.readFileSync('c:/Users/usuario/Downloads/traceflow-erp (1)/components/AdvancedOrderEntry.tsx', 'utf-8');

// 1. Rename Component
code = code.replace(/export const NewSale: React\.FC = \(\) => \{/g, 'export const AdvancedOrderEntry: React.FC = () => {');

// 2. Adjust Imports
code = code.replace(/import \{ Sale, SaleItem, Product, Client, PriceList, Config, CompanyConfig, AutoPromotion \} from '\.\.\/types';/g, 
  "import { Order, OrderItem, Product, Client, PriceList, Config, CompanyConfig, AutoPromotion } from '../types';");

// 3. Adjust Store access
code = code.replace(/sales, createSale, updateSaleDetailed,/g, 'orders, createOrder, updateOrder,');

// 4. Change states: originalSale -> originalOrder
code = code.replace(/const \[originalSale, setOriginalSale\] = useState<Sale \| null>\(null\);/g, 'const [originalOrder, setOriginalOrder] = useState<Order | null>(null);');
code = code.replace(/const \[filteredSales, setFilteredSales\] = useState<Sale\[\]>\(\[\]\);/g, 'const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);');
code = code.replace(/const \[saleSearchTerm, setSaleSearchTerm\] = useState\(''\);/g, 'const [orderSearchTerm, setOrderSearchTerm] = useState(\'\');');
code = code.replace(/const \[saleToPrint, setSaleToPrint\] = useState<Sale \| null>\(null\);/g, 'const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);');

// 5. Change "sale" usage to "order" in view/edit methods
code = code.replace(/loadSale\(/g, 'loadOrder(');
code = code.replace(/const loadOrder = \(sale: Sale/g, 'const loadOrder = (order: Order');
code = code.replace(/setOriginalSale\(sale\)/g, 'setOriginalOrder(order)');
code = code.replace(/setClientData\(\{\n         doc_number: sale\.client_ruc,\n         name: sale\.client_name,\n         address: sale\.client_address,\n         price_list_id: ''\n      \}\);/g, 'setClientData({\n         doc_number: order.client_doc_number,\n         name: order.client_name,\n         address: order.delivery_address || \'\',\n         price_list_id: \'\'\n      });');
code = code.replace(/setPaymentMethod\(sale\.payment_method\);/g, 'setPaymentMethod(order.payment_method);');
code = code.replace(/setCart\(sale\.items\);/g, 'setCart(order.items as any);'); // Casting temporarily because order items use different quantity field in UI
code = code.replace(/setDocType\(sale\.document_type as any\);/g, 'setDocType(order.suggested_document_type as any);');
code = code.replace(/saleSearchTerm/g, 'orderSearchTerm');
code = code.replace(/originalSale/g, 'originalOrder');

// 6. Search filtering: filter orders instead of sales
code = code.replace(/const matches = sales\.filter/g, 'const matches = orders.filter(o => o.status === "pending").filter');
code = code.replace(/\(s\.series \+ '-' \+ s\.number\)/g, '(o.code)');
code = code.replace(/s\.client_name/g, 'o.client_name');
code = code.replace(/s\.client_ruc/g, 'o.client_doc_number');
code = code.replace(/s => /g, 'o => ');
code = code.replace(/setFilteredSales\(matches\);/g, 'setFilteredOrders(matches);');
code = code.replace(/filteredSales/g, 'filteredOrders');

// 7. Save Logic
code = code.replace(/const newSaleData: Sale = \{[\s\S]*?sunat_status: isEditMode && originalOrder \? originalOrder\.sunat_status : 'PENDING'\n      \};/g, `
      const newOrderData: Order = {
         id: isEditMode && originalOrder ? originalOrder.id : crypto.randomUUID(),
         code: isEditMode && originalOrder ? originalOrder.code : 'PED-' + Math.floor(100000 + Math.random() * 900000),
         seller_id: currentUser?.id || '',
         client_id: clientData.doc_number,
         client_name: clientData.name,
         client_doc_type: clientData.doc_number.length === 11 ? 'RUC' : 'DNI',
         client_doc_number: clientData.doc_number,
         suggested_document_type: docType as any,
         payment_method: paymentMethod as any,
         delivery_date: new Date().toISOString(),
         total: grandTotal,
         status: 'pending',
         delivery_mode: 'REGULAR',
         delivery_address: clientData.address,
         created_at: isEditMode && originalOrder ? originalOrder.created_at : new Date().toISOString(),
         items: cart.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            unit_type: item.selected_unit || 'UND',
            quantity: item.quantity_base,
            unit_price: item.unit_price,
            total_price: item.total_price,
            is_promo: item.is_promo,
            is_bonus: item.is_bonus,
            auto_promo_id: item.auto_promo_id,
            discount_percent: item.discount_percent,
            discount_amount: item.discount_amount,
            batch_allocations: item.batch_allocations
         }))
      };
`);

code = code.replace(/const result = updateSaleDetailed\(newSaleData, originalOrder, currentUser\?.name \|\| 'ADMIN'\);/g, 'updateOrder(newOrderData);');
code = code.replace(/if \(!result\.success\) \{[\s\S]*?return;\n         \}\n         alert\(result\.msg\);/g, 'alert("Pedido actualizado correctamente");');
code = code.replace(/createSale\(newSaleData\);/g, 'createOrder(newOrderData);\n         alert("Pedido creado correctamente");');

// 8. Remove mass invoice PDF 
code = code.replace(/generateMassiveInvoicePDF\(company, \[newSaleData\]\);/g, '');

// 9. Fix print
code = code.replace(/setSaleToPrint\(newOrderData\);/g, 'setOrderToPrint(newOrderData);');
code = code.replace(/saleToPrint/g, 'orderToPrint');

// 10. UI texts
code = code.replace(/Buscar Documento/g, 'Buscar Pedido');
code = code.replace(/Nueva Venta Directa/g, 'Nuevo Pedido Avanzado');
code = code.replace(/handleNewSale/g, 'handleNewOrder');
code = code.replace(/Historial de Documento/g, 'Historial de Pedido');
code = code.replace(/sunat_status/g, 'status');


fs.writeFileSync('c:/Users/usuario/Downloads/traceflow-erp (1)/components/AdvancedOrderEntry.tsx', code);
console.log('TRANSFORMED AdvancedOrderEntry');
