const fs = require('fs');
const file = 'c:\\Users\\usuario\\Downloads\\traceflow-erp (1)\\components\\Kardex.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/supabase\.from\('stock_transfers'\)\.select\('\*'\)/g, "supabase.from('transfer_documents').select('*, items:transfer_items(*)')");

const regex = /\(dbTransfers \|\| \[\]\)\.forEach\(t => \{[\s\S]*?DE: \$\{t\.origin_warehouse_id\}`\r?\n\s*\}\);\r?\n\s*\}\);/m;

const replacement = `(dbTransfers || []).forEach(t => {
   const date = (t.created_at || new Date().toISOString()).split('T')[0];
   (t.items || []).forEach((item: any) => {
      const prod = (dbProducts || []).find(x => x.id === item.product_id);
      if (!prod) return;
      if (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && !(prod.sku || '').toLowerCase().includes(searchTerm.toLowerCase())) return;
      if (filterCategory !== 'ALL' && prod.category !== filterCategory) return;
      if (filterSupplier !== 'ALL' && prod.supplier_id !== filterSupplier) return;
      
      list.push({
         id: \`TRF-OUT-\${t.id}-\${item.id}\`,
         date, type: 'OUT', docType: 'TRASLADO', docNumber: t.document_number || 'MERMA/DAÑO',
         productName: prod.name || '', sku: prod.sku || '', quantity: item.quantity_base || 0, unitPrice: 0, total: 0, reference: \`A: \${t.dest_warehouse_id}\`
      });
      list.push({
         id: \`TRF-IN-\${t.id}-\${item.id}\`,
         date, type: 'IN', docType: 'TRASLADO', docNumber: t.document_number || 'MERMA/DAÑO',
         productName: prod.name || '', sku: prod.sku || '', quantity: item.quantity_base || 0, unitPrice: 0, total: 0, reference: \`DE: \${t.origin_warehouse_id}\`
      });
   });
});`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
console.log('Kardex.tsx updated successfully');
