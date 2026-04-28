import { Product, BatchAllocation, Batch } from '../types';

/**
 * Normaliza y compara el nombre de dos unidades de medida.
 */
export const isPackageUnit = (unitName: string, product: Product): boolean => {
    if (!unitName || !product) return false;
    
    // Extraer solo el nombre de la unidad, ignorando el factor de conversión si existe (ej. "CAJ / 12" -> "CAJ")
    const baseUnitName = unitName.split('/')[0].trim().toUpperCase();
    
    if (baseUnitName === 'PKG' || baseUnitName === 'CJA' || baseUnitName === 'CAJA' || baseUnitName === 'CAJ') return true;
    if (product.package_type && baseUnitName === product.package_type.trim().toUpperCase()) return true;
    
    return false;
};

/**
 * Calcula la cantidad base estricta basándose en el maestro de productos.
 * Retorna un objeto con la cantidad base real y si es considerado paquete.
 */
export const calculateBaseQuantity = (product: Product, selectedUnit: string, presentationQty: number) => {
    const isPkg = isPackageUnit(selectedUnit, product);
    const conversionFactor = isPkg ? Number(product.package_content || 1) : 1;
    const quantityBase = Number(presentationQty) * conversionFactor;

    return {
        isPkg,
        conversionFactor,
        quantityBase
    };
};

/**
 * Ejecuta la lógica FIFO para asignar cantidades de stock de los lotes disponibles.
 * @param requiredBaseQty La cantidad base total requerida.
 * @param availableBatches Lotes disponibles para este producto.
 * @param ignoreStockLimit Si es verdadero, permite forzar stock negativo (auditoría). Si no, y falta stock, lanza error o retorna lo que se pudo.
 */
export const allocateBatchesFIFO = (
    requiredBaseQty: number, 
    availableBatches: any[], 
    ignoreStockLimit: boolean = false
): BatchAllocation[] => {
    let remaining = requiredBaseQty;
    const selectedBatches: BatchAllocation[] = [];
    
    for (const batch of availableBatches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(batch.quantity_current || 0));
        
        if (take > 0) {
            selectedBatches.push({ 
                batch_id: batch.id, 
                batch_code: batch.code || batch.batch_code, 
                quantity: take 
            });
            remaining -= take;
        }
    }

    // Si aún queda restante y no se ignora el límite, podríamos manejar un aviso o devolver lo parcial.
    // Usualmente el comprobante se bloquea ANTES de llamar a esto si no hay stock total disponible (a menos que se fuerce).
    
    return selectedBatches;
};
