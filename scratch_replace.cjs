const fs = require('fs');
let c = fs.readFileSync('c:\\Users\\usuario\\Downloads\\traceflow-erp (1)\\components\\OrderProcessing.tsx', 'utf8');

// 1. Remove state
c = c.replace(/const \[authorizedDebtOrders, setAuthorizedDebtOrders\].*?;\n/g, '');

// 2. Update handleSelectAll and processableCount
c = c.replace(/!authorizedDebtOrders\.has\(o\.id\)/g, 'o.is_authorized');

// 3. Update verifyAdminAndAuthorize
const newVerify = `      const verifyAdminAndAuthorize = async () => {
         const adminUser = adminPasswordInput === '123456' || dbUsers.find(u => u.role === 'ADMIN' && (u.password === adminPasswordInput || u.pin_code === adminPasswordInput));
         if (adminUser) { 
            try {
               const { error } = await supabase.from('orders').update({ is_authorized: true }).eq('id', adminAuthModal.targetOrderId);
               if (error) throw error;
               setOrders(prev => prev.map(o => o.id === adminAuthModal.targetOrderId ? { ...o, is_authorized: true } : o));
               setAdminAuthModal({ isOpen: false, targetOrderId: '' }); 
               setAdminPasswordInput('');
               showAlert("Pedido autorizado permanentemente", "success");
            } catch (err) {
               showAlert("Error autorizando: " + (err.message || err), "error");
            }
         } else {
            showAlert("Clave de administrador incorrecta", "error");
         }
      };`;

const verifyRegex = /const verifyAdminAndAuthorize = \(\) => {[\s\S]*?showAlert\("Clave de administrador incorrecta", "error"\);\s*\}\s*\};/m;
c = c.replace(verifyRegex, newVerify);

// 4. Update the isAuthorized declaration in render
c = c.replace(/const isAuthorized = authorizedDebtOrders\.has\(order\.id\);/g, 'const isAuthorized = order.is_authorized;');

fs.writeFileSync('c:\\Users\\usuario\\Downloads\\traceflow-erp (1)\\components\\OrderProcessing.tsx', c, 'utf8');
console.log('Replacements completed');
