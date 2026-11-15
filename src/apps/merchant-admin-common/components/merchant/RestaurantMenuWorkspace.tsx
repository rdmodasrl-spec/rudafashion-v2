import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, RefreshCw, ShoppingBasket, Utensils } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '../../../../api/client';

type RestaurantDish = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
};

type RestaurantMenuItem = {
  id: string;
  price: string;
  status: 'available' | 'sold_out' | 'hidden';
  dish: RestaurantDish;
};

type RestaurantMenu = {
  id: string;
  version: number;
  name: string;
  description: string;
  currency: string;
  status: 'draft' | 'published' | 'archived';
  items?: RestaurantMenuItem[];
  _count?: { items: number };
};

type RestaurantIngredient = {
  id: string;
  category: string;
  allergens: string[];
  material: {
    code: string;
    name: string;
    unit: string;
    reorderPoint: number;
    leadTimeDays: number;
  };
};

type RestaurantRecipe = {
  id: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  yieldQuantity: string;
  yieldUnit: 'portion' | 'piece' | 'batch';
  items: Array<{
    ingredientId: string;
    ingredientNameSnapshot: string;
    quantity: string;
    unitSnapshot: string;
    wasteRate: string;
  }>;
};

type RecipeDraftItem = { ingredientId: string; quantity: string; wasteRate: string };
type RecipeDraft = {
  yieldQuantity: string;
  yieldUnit: RestaurantRecipe['yieldUnit'];
  notes: string;
  items: RecipeDraftItem[];
};
type IngredientDraft = {
  code: string;
  name: string;
  category: string;
  unit: string;
  reorderPoint: string;
  leadTimeDays: string;
  allergens: string;
};

type MenuDraft = { name: string; currency: string };
type DishDraft = { name: string; category: string; description: string };
type ItemDraft = { dishId: string; price: string };
type RestaurantSupplier = { id: string; name: string; status: string };
type RestaurantPurchaseOrder = {
  id: string;
  version: number;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  currency: string;
  supplier: { id: string; name: string };
  items: Array<{
    id: string;
    ingredientId: string;
    ingredientNameSnapshot: string;
    unitSnapshot: string;
    orderedQuantity: string;
    receivedQuantity: string;
    quotedUnitCost: string;
  }>;
};
type PurchaseDraftItem = { ingredientId: string; orderedQuantity: string; quotedUnitCost: string };
type ReceiptDraftItem = { quantity: string; unitCost: string };

const emptyMenuDraft = (): MenuDraft => ({ name: '', currency: 'EUR' });
const emptyDishDraft = (): DishDraft => ({ name: '', category: '', description: '' });
const emptyItemDraft = (): ItemDraft => ({ dishId: '', price: '' });
const emptyPurchaseDraftItem = (): PurchaseDraftItem => ({ ingredientId: '', orderedQuantity: '', quotedUnitCost: '' });
const emptyIngredientDraft = (): IngredientDraft => ({
  code: '', name: '', category: 'produce', unit: 'kg', reorderPoint: '0', leadTimeDays: '0', allergens: ''
});
const emptyRecipeDraft = (): RecipeDraft => ({
  yieldQuantity: '1',
  yieldUnit: 'portion',
  notes: '',
  items: [{ ingredientId: '', quantity: '', wasteRate: '0' }]
});
const allergenCodes = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'nuts',
  'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs', 'other'
];

function menuErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : fallback;
  switch (error.code) {
    case 'RESTAURANT_INDUSTRY_REQUIRED':
      return '当前账号没有餐饮工作区权限，请确认商家行业和审核状态。';
    case 'EMPLOYEE_PERMISSION_REQUIRED':
      return '当前员工没有执行此餐饮操作的权限。';
    case 'STORE_ACCESS_DENIED':
      return '当前账号没有访问该门店的权限。';
    case 'IDEMPOTENCY_KEY_REUSED':
      return '请求结果不确定，请刷新后确认是否已创建。';
    case 'RESTAURANT_MENU_ITEM_EXISTS':
      return '该菜品已加入此菜单。';
    case 'RESTAURANT_MENU_ACTIVE_RECIPE_REQUIRED':
      return '菜单中的每道菜都需要先激活有效配方。';
    case 'RESTAURANT_MENU_EMPTY':
      return '空菜单不能发布，请先添加菜品。';
    case 'RESTAURANT_MENU_VERSION_CONFLICT':
    case 'RESTAURANT_MENU_CONCURRENT_CHANGE':
      return '菜单已被其他操作更新，请刷新后确认最新状态。';
    case 'RESTAURANT_RECIPE_VERSION_CONFLICT':
      return '配方已被其他操作更新，请重新读取后再试。';
    case 'RESTAURANT_INGREDIENT_CODE_ALREADY_EXISTS':
      return '原料编码已存在，请更换编码。';
    case 'RESTAURANT_INGREDIENT_INPUT_INVALID':
      return '原料资料不完整或格式无效，请检查编码、单位、阈值及供货天数。';
    case 'RESTAURANT_RECIPE_INPUT_INVALID':
      return '配方资料不完整或格式无效，请检查产出、原料用量和损耗率。';
    case 'RESTAURANT_INGREDIENT_NOT_FOUND':
      return '配方引用的原料不存在或不属于当前餐厅，请刷新原料目录。';
    case 'RESTAURANT_PURCHASE_REFERENCE_NOT_FOUND':
      return '供应商或原料已不可用，请刷新后重新选择。';
    case 'RESTAURANT_PURCHASE_ORDER_VERSION_CONFLICT':
    case 'RESTAURANT_PURCHASE_ORDER_CONCURRENT_CHANGE':
      return '采购单已被其他员工更新，请刷新后核对实际收货状态。';
    case 'RESTAURANT_PURCHASE_ORDER_STATE_INVALID':
      return '当前采购单状态不支持此操作，请刷新后确认。';
    case 'RESTAURANT_PURCHASE_RECEIPT_INPUT_INVALID':
    case 'RESTAURANT_PURCHASE_RECEIPT_LINES_INVALID':
      return '收货资料无效或超出未收数量，请核对到货记录。';
    case 'RESTAURANT_STORE_INVENTORY_NOT_CONFIGURED':
      return '当前员工绑定的门店尚未配置独立原料仓；请由有权限的总部账号登记收货。';
    default:
      return error.message || fallback;
  }
}

export const RestaurantMenuWorkspace: React.FC = () => {
  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [dishes, setDishes] = useState<RestaurantDish[]>([]);
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [menuDraft, setMenuDraft] = useState<MenuDraft>(emptyMenuDraft);
  const [dishDraft, setDishDraft] = useState<DishDraft>(emptyDishDraft);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItemDraft);
  const [ingredients, setIngredients] = useState<RestaurantIngredient[]>([]);
  const [ingredientDraft, setIngredientDraft] = useState<IngredientDraft>(emptyIngredientDraft);
  const [recipeDishId, setRecipeDishId] = useState('');
  const [recipes, setRecipes] = useState<RestaurantRecipe[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(emptyRecipeDraft);
  const [costResult, setCostResult] = useState<{
    cost: { status: string; currency: string | null; costPerYield: string | null; method: string };
    menuComparison?: { status: string; grossMargin: string | null; grossMarginRate: string | null };
  } | null>(null);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [showDishForm, setShowDishForm] = useState(false);
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [showProcurement, setShowProcurement] = useState(false);
  const [procurementLoaded, setProcurementLoaded] = useState(false);
  const [procurementLoading, setProcurementLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<RestaurantSupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<RestaurantPurchaseOrder[]>([]);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchaseCurrency, setPurchaseCurrency] = useState('EUR');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseDraftItem[]>([emptyPurchaseDraftItem()]);
  const [receivingOrder, setReceivingOrder] = useState<RestaurantPurchaseOrder | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<Record<string, ReceiptDraftItem>>({});
  const [procurementError, setProcurementError] = useState('');
  const [procurementNotice, setProcurementNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const createRequest = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const purchaseCreateRequest = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const receiptRequest = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const menuLoadSequence = useRef(0);

  const loadMenu = async (menuId: string) => {
    const sequence = ++menuLoadSequence.current;
    try {
      const result = await apiGet<{ menu: RestaurantMenu }>(`/api/merchant/restaurant/menus/${encodeURIComponent(menuId)}`);
      if (sequence === menuLoadSequence.current) {
        setMenu(result.menu);
        setError('');
      }
    } catch (requestError) {
      if (sequence === menuLoadSequence.current) {
        setError(menuErrorMessage(requestError, '菜单详情读取失败。'));
      }
    }
  };

  const reload = async (preferredMenuId?: string) => {
    setLoading(true);
    setError('');
    try {
      const [menuResult, dishResult, ingredientResult] = await Promise.all([
        apiGet<{ menus: RestaurantMenu[] }>('/api/merchant/restaurant/menus?limit=100'),
        apiGet<{ dishes: RestaurantDish[] }>('/api/merchant/restaurant/dishes?limit=100'),
        apiGet<{ ingredients: RestaurantIngredient[] }>('/api/merchant/restaurant/ingredients?limit=100')
      ]);
      setMenus(menuResult.menus);
      setDishes(dishResult.dishes);
      setIngredients(ingredientResult.ingredients);
      const selectedRecipeDish = dishResult.dishes.some(item => item.id === recipeDishId && item.status !== 'archived')
        ? recipeDishId
        : dishResult.dishes.find(item => item.status !== 'archived')?.id || '';
      setRecipeDishId(selectedRecipeDish);
      if (selectedRecipeDish) await loadRecipes(selectedRecipeDish);
      else setRecipes([]);
      const selectedId = preferredMenuId
        ?? menuResult.menus.find(item => item.id === menu?.id)?.id
        ?? menuResult.menus[0]?.id;
      if (selectedId) await loadMenu(selectedId);
      else setMenu(null);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '菜单资料读取失败，请重试。'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const loadProcurement = async () => {
    setProcurementLoading(true);
    setProcurementError('');
    try {
      const [supplierResult, orderResult] = await Promise.all([
        apiGet<{ suppliers: RestaurantSupplier[] }>('/api/merchant/suppliers'),
        apiGet<{ purchaseOrders: RestaurantPurchaseOrder[] }>('/api/merchant/restaurant/purchase-orders?page=1&pageSize=50')
      ]);
      setSuppliers(supplierResult.suppliers);
      setPurchaseOrders(orderResult.purchaseOrders);
      setPurchaseSupplierId(current => current || supplierResult.suppliers.find(supplier => supplier.status === 'active')?.id || '');
      setProcurementLoaded(true);
    } catch (requestError) {
      setProcurementError(menuErrorMessage(requestError, '采购资料读取失败，请确认采购权限后重试。'));
    } finally {
      setProcurementLoading(false);
    }
  };

  const toggleProcurement = () => {
    const opening = !showProcurement;
    setShowProcurement(opening);
    if (opening && !procurementLoaded && !procurementLoading) void loadProcurement();
  };

  const createPurchaseOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    const items = purchaseItems.map(item => ({
      ingredientId: item.ingredientId,
      orderedQuantity: item.orderedQuantity.trim(),
      quotedUnitCost: item.quotedUnitCost.trim()
    }));
    if (!purchaseSupplierId || !/^[A-Z]{3}$/.test(purchaseCurrency)
      || items.some(item => !item.ingredientId || !item.orderedQuantity || !item.quotedUnitCost)
      || new Set(items.map(item => item.ingredientId)).size !== items.length) {
      setProcurementError('请填写供应商、币种，并为每种原料填写数量和报价；同一原料只保留一行。');
      return;
    }
    const payload = {
      supplierId: purchaseSupplierId,
      currency: purchaseCurrency,
      notes: purchaseNotes.trim(),
      items
    };
    const fingerprint = JSON.stringify(payload);
    if (purchaseCreateRequest.current?.fingerprint !== fingerprint) {
      purchaseCreateRequest.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setBusy(true);
    setProcurementError('');
    setProcurementNotice('');
    try {
      await apiPost('/api/merchant/restaurant/purchase-orders', payload, undefined, {
        'Idempotency-Key': purchaseCreateRequest.current.idempotencyKey
      });
      purchaseCreateRequest.current = null;
      setPurchaseNotes('');
      setPurchaseItems([emptyPurchaseDraftItem()]);
      setProcurementNotice('采购草稿已保存；提交后才能登记实际收货。');
      await loadProcurement();
    } catch (requestError) {
      setProcurementError(menuErrorMessage(requestError, '采购草稿保存失败；可安全重试。'));
    } finally {
      setBusy(false);
    }
  };

  const submitPurchaseOrder = async (order: RestaurantPurchaseOrder) => {
    if (busy || !window.confirm(`确认向 ${order.supplier.name} 提交采购单？`)) return;
    setBusy(true);
    setProcurementError('');
    setProcurementNotice('');
    try {
      await apiPost(`/api/merchant/restaurant/purchase-orders/${encodeURIComponent(order.id)}/submit`, {
        expectedVersion: order.version
      });
      setProcurementNotice('采购单已提交。收到货物后，请按实际数量和发票单价登记收货。');
      await loadProcurement();
    } catch (requestError) {
      setProcurementError(menuErrorMessage(requestError, '采购单提交失败，请刷新确认最新状态。'));
    } finally {
      setBusy(false);
    }
  };

  const beginReceipt = (order: RestaurantPurchaseOrder) => {
    setReceivingOrder(order);
    setReceiptDraft(Object.fromEntries(order.items
      .filter(item => Number(item.orderedQuantity) > Number(item.receivedQuantity))
      .map(item => [item.id, { quantity: '', unitCost: '' }])));
    setProcurementError('');
    setProcurementNotice('');
  };

  const updateReceiptDraft = (itemId: string, field: keyof ReceiptDraftItem, value: string) => {
    setReceiptDraft(current => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value.replace(',', '.') }
    }));
  };

  const receivePurchaseOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!receivingOrder || busy) return;
    const items = Object.entries(receiptDraft)
      .filter(([, values]) => values.quantity.trim() || values.unitCost.trim())
      .map(([itemId, values]) => ({ itemId, quantity: values.quantity.trim(), unitCost: values.unitCost.trim() }));
    if (!items.length || items.some(item => !item.quantity || !item.unitCost
      || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0
      || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0)) {
      setProcurementError('请至少登记一项实际收货，并填写核对后的到货数量和发票单价。');
      return;
    }
    const payload = {
      expectedVersion: receivingOrder.version,
      note: '',
      items
    };
    const fingerprint = JSON.stringify({ orderId: receivingOrder.id, ...payload });
    if (receiptRequest.current?.fingerprint !== fingerprint) {
      receiptRequest.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setBusy(true);
    setProcurementError('');
    setProcurementNotice('');
    try {
      await apiPost(
        `/api/merchant/restaurant/purchase-orders/${encodeURIComponent(receivingOrder.id)}/receipts`,
        payload,
        undefined,
        { 'Idempotency-Key': receiptRequest.current.idempotencyKey }
      );
      receiptRequest.current = null;
      setReceivingOrder(null);
      setReceiptDraft({});
      setProcurementNotice('实际收货已保存；库存与成本来源已由服务端更新。');
      await Promise.all([loadProcurement(), reload()]);
    } catch (requestError) {
      setProcurementError(menuErrorMessage(requestError, '收货未确认成功。请刷新采购单后再试，避免重复登记。'));
    } finally {
      setBusy(false);
    }
  };

  const loadRecipes = async (dishId: string) => {
    try {
      const result = await apiGet<{ recipes: RestaurantRecipe[] }>(
        `/api/merchant/restaurant/dishes/${encodeURIComponent(dishId)}/recipes?limit=100`
      );
      setRecipes(result.recipes);
      setCostResult(null);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '配方历史读取失败。'));
    }
  };

  const createMenu = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const payload = { name: menuDraft.name, currency: menuDraft.currency };
    const fingerprint = JSON.stringify(payload);
    if (createRequest.current?.fingerprint !== fingerprint) {
      createRequest.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    try {
      const result = await apiPost<{ menu: RestaurantMenu }>('/api/merchant/restaurant/menus', payload, undefined, {
        'Idempotency-Key': createRequest.current.idempotencyKey
      });
      createRequest.current = null;
      setMenuDraft(emptyMenuDraft());
      setShowMenuForm(false);
      setNotice('菜单草稿已保存。');
      await reload(result.menu.id);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '菜单创建失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  const createDish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const payload = { ...dishDraft, nameZh: dishDraft.name };
    const fingerprint = JSON.stringify(payload);
    if (createRequest.current?.fingerprint !== fingerprint) {
      createRequest.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    try {
      await apiPost('/api/merchant/restaurant/dishes', payload, undefined, {
        'Idempotency-Key': createRequest.current.idempotencyKey
      });
      createRequest.current = null;
      setDishDraft(emptyDishDraft());
      setShowDishForm(false);
      setNotice('菜品资料已保存为草稿。');
      await reload();
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '菜品创建失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  const addDish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!menu || !itemDraft.dishId || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost(
        `/api/merchant/restaurant/menus/${encodeURIComponent(menu.id)}/items`,
        { dishId: itemDraft.dishId, price: itemDraft.price }
      );
      setItemDraft(emptyItemDraft());
      setNotice('菜品已加入菜单草稿。');
      await reload();
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '菜品加入菜单失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  const createIngredient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const allergens = ingredientDraft.allergens.split(',').map(value => value.trim()).filter(Boolean);
    if (allergens.some(code => !allergenCodes.includes(code)) || new Set(allergens).size !== allergens.length) {
      setError(`过敏原请使用唯一代码并以逗号分隔：${allergenCodes.join(', ')}`);
      return;
    }
    const payload = {
      code: ingredientDraft.code.trim(),
      name: ingredientDraft.name.trim(),
      category: ingredientDraft.category,
      unit: ingredientDraft.unit,
      allergens,
      reorderPoint: ingredientDraft.reorderPoint,
      leadTimeDays: Number(ingredientDraft.leadTimeDays)
    };
    const fingerprint = JSON.stringify(payload);
    if (createRequest.current?.fingerprint !== fingerprint) {
      createRequest.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/merchant/restaurant/ingredients', payload, undefined, {
        'Idempotency-Key': createRequest.current.idempotencyKey
      });
      createRequest.current = null;
      setIngredientDraft(emptyIngredientDraft());
      setShowIngredientForm(false);
      setNotice('原料已保存。');
      await reload();
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '原料创建失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  const createRecipe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recipeDishId || busy) return;
    const selectedIngredients = recipeDraft.items.map(item => item.ingredientId);
    if (selectedIngredients.some(id => !id) || new Set(selectedIngredients).size !== selectedIngredients.length) {
      setError('每项都需选择原料，且同一配方不能重复添加同一原料。');
      return;
    }
    const payload = {
      ...recipeDraft,
      items: recipeDraft.items.map(item => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        wasteRate: item.wasteRate || '0'
      }))
    };
    const fingerprint = JSON.stringify(payload);
    if (createRequest.current?.fingerprint !== fingerprint) {
      createRequest.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost(
        `/api/merchant/restaurant/dishes/${encodeURIComponent(recipeDishId)}/recipes`,
        payload,
        undefined,
        { 'Idempotency-Key': createRequest.current.idempotencyKey }
      );
      createRequest.current = null;
      setRecipeDraft(emptyRecipeDraft());
      setShowRecipeForm(false);
      setNotice('新的配方版本已保存为草稿。');
      await loadRecipes(recipeDishId);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '配方版本创建失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  const activateRecipe = async (recipe: RestaurantRecipe) => {
    if (busy || !window.confirm(`激活 ${recipe.version} 版配方？已激活的旧版本将归档。`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/merchant/restaurant/recipes/${encodeURIComponent(recipe.id)}/activate`, {
        expectedVersion: recipe.version
      });
      setNotice(`配方 V${recipe.version} 已激活。`);
      await loadRecipes(recipeDishId);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '配方激活失败，请刷新后重试。'));
    } finally {
      setBusy(false);
    }
  };

  const readCost = async (dishId: string) => {
    setError('');
    try {
      const result = await apiGet<NonNullable<typeof costResult>>(
        `/api/merchant/restaurant/dishes/${encodeURIComponent(dishId)}/cost${menu ? `?menuId=${encodeURIComponent(menu.id)}` : ''}`
      );
      setCostResult(result);
    } catch (requestError) {
      setCostResult(null);
      setError(menuErrorMessage(requestError, '成本读取失败；请检查采购成本与员工权限。'));
    }
  };

  const transitionMenu = async (action: 'publish' | 'unpublish') => {
    if (!menu || busy) return;
    const message = action === 'publish'
      ? '确认正式发布此菜单？顾客可通过公开店铺目录查看已发布内容。'
      : '确认撤回此菜单？公开店铺将不再展示此菜单。';
    if (!window.confirm(message)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/merchant/restaurant/menus/${encodeURIComponent(menu.id)}/${action}`, {
        expectedVersion: menu.version
      });
      setNotice(action === 'publish' ? '菜单已正式发布。' : '菜单已撤回为草稿。');
      await reload(menu.id);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, '菜单状态更新失败，请刷新后确认。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="restaurant-menu-title">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h2 id="restaurant-menu-title" className="text-xl font-semibold text-neutral-950">菜单管理</h2>
          <p className="mt-1 text-sm text-neutral-600">维护菜品与菜单草稿。POS 收银、厨房出单和顾客点单尚未开放。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />刷新
          </button>
          <button type="button" onClick={() => { setShowDishForm(value => !value); setShowMenuForm(false); }} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            <Utensils className="h-4 w-4" aria-hidden="true" />新增菜品
          </button>
          <button type="button" onClick={() => { setShowIngredientForm(value => !value); setShowRecipeForm(false); }} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            <Plus className="h-4 w-4" aria-hidden="true" />新增原料
          </button>
          <button type="button" onClick={toggleProcurement} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50" aria-expanded={showProcurement}>
            <ShoppingBasket className="h-4 w-4" aria-hidden="true" />采购收货
          </button>
          <button type="button" onClick={() => { setShowMenuForm(value => !value); setShowDishForm(false); }} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-3 text-sm font-semibold text-white hover:bg-neutral-800">
            <Plus className="h-4 w-4" aria-hidden="true" />新建菜单
          </button>
        </div>
      </header>

      {error && <p role="alert" className="border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm text-neutral-800">{error}</p>}
      {notice && <p role="status" className="text-sm text-neutral-700">{notice}</p>}

      {showProcurement && (
        <section className="space-y-4 border-y border-neutral-200 py-4" aria-labelledby="restaurant-procurement-title">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="restaurant-procurement-title" className="text-base font-semibold text-neutral-900">原料采购与实收</h3>
              <p className="mt-1 text-sm text-neutral-600">按实际到货数量和发票单价收货；成本只读取服务端已保存的收货记录。</p>
            </div>
            <button type="button" onClick={() => void loadProcurement()} disabled={procurementLoading || busy} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${procurementLoading ? 'animate-spin' : ''}`} aria-hidden="true" />刷新采购
            </button>
          </header>
          {procurementError && <p role="alert" className="border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-800">{procurementError}</p>}
          {procurementNotice && <p role="status" className="text-sm text-neutral-700">{procurementNotice}</p>}
          {procurementLoading && <p className="text-sm text-neutral-600">正在读取供应商和采购记录…</p>}
          {!procurementLoading && suppliers.length === 0 && (
            <p className="text-sm text-neutral-600">尚无供应商。请先在现有供应商管理中创建并启用供应商，再回来建立餐饮采购单。</p>
          )}
          {!procurementLoading && suppliers.some(supplier => supplier.status === 'active') && (
            <form onSubmit={event => void createPurchaseOrder(event)} className="space-y-3">
              <h4 className="text-sm font-semibold text-neutral-800">新建采购草稿</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-sm font-medium text-neutral-700">
                  供应商
                  <select required value={purchaseSupplierId} onChange={event => setPurchaseSupplierId(event.target.value)} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm">
                    <option value="">选择供应商</option>
                    {suppliers.filter(supplier => supplier.status === 'active').map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-neutral-700">
                  币种
                  <input required minLength={3} maxLength={3} value={purchaseCurrency} onChange={event => setPurchaseCurrency(event.target.value.toUpperCase())} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm uppercase" />
                </label>
                <label className="space-y-1 text-sm font-medium text-neutral-700 sm:col-span-2">
                  备注
                  <input maxLength={2000} value={purchaseNotes} onChange={event => setPurchaseNotes(event.target.value)} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                </label>
              </div>
              {purchaseItems.map((item, index) => (
                <div key={index} className="grid gap-2 border-b border-neutral-200 pb-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_auto] sm:items-end">
                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    原料
                    <select required value={item.ingredientId} onChange={event => setPurchaseItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ingredientId: event.target.value } : row))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm">
                      <option value="">选择原料</option>
                      {ingredients.map(ingredient => <option key={ingredient.id} value={ingredient.id}>{ingredient.material.name} · {ingredient.material.unit}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    订购数量
                    <input required inputMode="decimal" value={item.orderedQuantity} onChange={event => setPurchaseItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, orderedQuantity: event.target.value.replace(',', '.') } : row))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    报价 / 单位
                    <input required inputMode="decimal" value={item.quotedUnitCost} onChange={event => setPurchaseItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, quotedUnitCost: event.target.value.replace(',', '.') } : row))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                  </label>
                  <button type="button" onClick={() => setPurchaseItems(current => current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : current)} disabled={purchaseItems.length === 1} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-medium text-neutral-700 disabled:opacity-50">移除</button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPurchaseItems(current => [...current, emptyPurchaseDraftItem()])} disabled={purchaseItems.length >= 100} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-medium text-neutral-700 disabled:opacity-50">添加原料</button>
                <button type="submit" disabled={busy || !ingredients.length} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? '保存中…' : '保存采购草稿'}</button>
              </div>
            </form>
          )}
          {!procurementLoading && purchaseOrders.length === 0 && (
            <p className="text-sm text-neutral-600">还没有餐饮采购记录。保存采购草稿后，确认提交并在到货时登记实收。</p>
          )}
          {purchaseOrders.length > 0 && (
            <ul className="divide-y divide-neutral-200" aria-label="餐饮采购记录">
              {purchaseOrders.map(order => (
                <li key={order.id} className="space-y-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">{order.supplier.name} · {order.status === 'draft' ? '草稿' : order.status === 'ordered' ? '已提交' : order.status === 'partially_received' ? '部分收货' : order.status === 'received' ? '已收齐' : '已取消'}</p>
                      <p className="mt-1 text-sm text-neutral-600">{order.items.map(item => `${item.ingredientNameSnapshot} ${item.receivedQuantity}/${item.orderedQuantity} ${item.unitSnapshot}`).join('；')}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {order.status === 'draft' && <button type="button" onClick={() => void submitPurchaseOrder(order)} disabled={busy} className="min-h-9 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-semibold text-neutral-800 disabled:opacity-60">确认提交</button>}
                      {(order.status === 'ordered' || order.status === 'partially_received') && <button type="button" onClick={() => beginReceipt(order)} disabled={busy} className="min-h-9 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-3 text-sm font-semibold text-white disabled:opacity-60">登记实收</button>}
                    </div>
                  </div>
                  {receivingOrder?.id === order.id && (
                    <form onSubmit={event => void receivePurchaseOrder(event)} className="space-y-3 border-t border-neutral-200 pt-3">
                      <p className="text-sm text-neutral-700">仅填写本次实际到货；单价按发票核对，可分批收货。</p>
                      {order.items.filter(item => Number(item.orderedQuantity) > Number(item.receivedQuantity)).map(item => (
                        <div key={item.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)]">
                          <p className="self-center text-sm font-medium text-neutral-800">{item.ingredientNameSnapshot} · 剩余 {Number(item.orderedQuantity) - Number(item.receivedQuantity)} {item.unitSnapshot}</p>
                          <label className="space-y-1 text-sm text-neutral-700">实收数量
                            <input inputMode="decimal" value={receiptDraft[item.id]?.quantity ?? ''} onChange={event => updateReceiptDraft(item.id, 'quantity', event.target.value)} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                          </label>
                          <label className="space-y-1 text-sm text-neutral-700">发票单价（{order.currency}）
                            <input inputMode="decimal" value={receiptDraft[item.id]?.unitCost ?? ''} onChange={event => updateReceiptDraft(item.id, 'unitCost', event.target.value)} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                          </label>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={busy} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? '保存中…' : '确认实际收货'}</button>
                        <button type="button" onClick={() => setReceivingOrder(null)} disabled={busy} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-4 text-sm font-medium text-neutral-700 disabled:opacity-60">取消</button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showMenuForm && (
        <form onSubmit={event => void createMenu(event)} className="grid gap-3 border-b border-neutral-200 pb-5 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end">
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            菜单名称
            <input required maxLength={160} value={menuDraft.name} onChange={event => setMenuDraft(current => ({ ...current, name: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            币种
            <input required minLength={3} maxLength={3} value={menuDraft.currency} onChange={event => setMenuDraft(current => ({ ...current, currency: event.target.value.toUpperCase() }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500" />
          </label>
          <button type="submit" disabled={busy} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? '保存中…' : '保存草稿'}</button>
        </form>
      )}

      {showDishForm && (
        <form onSubmit={event => void createDish(event)} className="grid gap-3 border-b border-neutral-200 pb-5 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            菜品名称
            <input required maxLength={160} value={dishDraft.name} onChange={event => setDishDraft(current => ({ ...current, name: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            分类
            <input maxLength={120} value={dishDraft.category} onChange={event => setDishDraft(current => ({ ...current, category: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700 sm:col-span-2">
            菜品说明
            <textarea maxLength={4000} rows={3} value={dishDraft.description} onChange={event => setDishDraft(current => ({ ...current, description: event.target.value }))} className="w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500" />
          </label>
          <button type="submit" disabled={busy} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-4 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-60">{busy ? '保存中…' : '保存菜品草稿'}</button>
        </form>
      )}

      {showIngredientForm && (
        <form onSubmit={event => void createIngredient(event)} className="grid gap-3 border-b border-neutral-200 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            原料编码
            <input required maxLength={80} value={ingredientDraft.code} onChange={event => setIngredientDraft(current => ({ ...current, code: event.target.value.toUpperCase() }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            原料名称
            <input required maxLength={200} value={ingredientDraft.name} onChange={event => setIngredientDraft(current => ({ ...current, name: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            类别
            <select value={ingredientDraft.category} onChange={event => setIngredientDraft(current => ({ ...current, category: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm">
              <option value="produce">蔬果</option><option value="meat">肉类</option><option value="seafood">水产</option><option value="dairy">乳制品</option><option value="grain">谷物</option><option value="seasoning">调味料</option><option value="beverage">饮品</option><option value="packaging">包装</option><option value="other">其他</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            计量单位
            <select value={ingredientDraft.unit} onChange={event => setIngredientDraft(current => ({ ...current, unit: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm">
              <option value="g">克 (g)</option><option value="kg">千克 (kg)</option><option value="ml">毫升 (ml)</option><option value="l">升 (l)</option><option value="piece">件 (piece)</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            预警阈值（计量单位）
            <input required inputMode="decimal" value={ingredientDraft.reorderPoint} onChange={event => setIngredientDraft(current => ({ ...current, reorderPoint: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            预计供货天数
            <input required type="number" min="0" max="3650" value={ingredientDraft.leadTimeDays} onChange={event => setIngredientDraft(current => ({ ...current, leadTimeDays: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700 sm:col-span-2">
            过敏原代码（逗号分隔）
            <input value={ingredientDraft.allergens} onChange={event => setIngredientDraft(current => ({ ...current, allergens: event.target.value }))} placeholder="例如：milk, nuts" className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
          </label>
          <button type="submit" disabled={busy} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? '保存中…' : '保存原料'}</button>
        </form>
      )}

      <section className="border-y border-neutral-200 py-4" aria-labelledby="restaurant-ingredients-title">
        <h3 id="restaurant-ingredients-title" className="text-base font-semibold text-neutral-900">原料目录</h3>
        {ingredients.length === 0 ? <p className="py-3 text-sm text-neutral-600">尚无原料记录；配方成本需要实际采购收货数据，不能用预警阈值推算。</p> : (
          <ul className="mt-2 divide-y divide-neutral-200">
            {ingredients.map(ingredient => (
              <li key={ingredient.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-neutral-800">{ingredient.material.name} <span className="font-normal text-neutral-600">· {ingredient.material.code}</span></span>
                <span className="text-neutral-600">{ingredient.material.unit} · 阈值 {ingredient.material.reorderPoint} · 过敏原 {ingredient.allergens.length ? ingredient.allergens.join(', ') : '未登记'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-b border-neutral-200 pb-5" aria-labelledby="restaurant-recipes-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="restaurant-recipes-title" className="text-base font-semibold text-neutral-900">配方与成本</h3>
            <p className="mt-1 text-sm text-neutral-600">配方版本不可覆盖；成本只读取实际采购收货记录。</p>
          </div>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            菜品
            <select value={recipeDishId} onChange={event => { setRecipeDishId(event.target.value); setRecipeDraft(emptyRecipeDraft()); setCostResult(null); void loadRecipes(event.target.value); }} className="ml-2 min-h-10 max-w-56 rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm">
              <option value="">选择菜品</option>
              {dishes.filter(dish => dish.status !== 'archived').map(dish => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
            </select>
          </label>
        </div>
        {recipeDishId && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowRecipeForm(value => !value)} disabled={ingredients.length === 0} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-semibold text-neutral-800 disabled:opacity-50">
              {showRecipeForm ? '收起配方' : '创建配方版本'}
            </button>
            <button type="button" onClick={() => void readCost(recipeDishId)} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-semibold text-neutral-800">读取真实成本</button>
          </div>
        )}
        {showRecipeForm && recipeDishId && (
          <form onSubmit={event => void createRecipe(event)} className="space-y-3 bg-neutral-50 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-neutral-700">产出数量<input required inputMode="decimal" value={recipeDraft.yieldQuantity} onChange={event => setRecipeDraft(current => ({ ...current, yieldQuantity: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm" /></label>
              <label className="space-y-1 text-sm font-medium text-neutral-700">产出单位<select value={recipeDraft.yieldUnit} onChange={event => setRecipeDraft(current => ({ ...current, yieldUnit: event.target.value as RecipeDraft['yieldUnit'] }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm"><option value="portion">份</option><option value="piece">件</option><option value="batch">批次</option></select></label>
              <label className="space-y-1 text-sm font-medium text-neutral-700">版本备注<input maxLength={2000} value={recipeDraft.notes} onChange={event => setRecipeDraft(current => ({ ...current, notes: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm" /></label>
            </div>
            {recipeDraft.items.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_140px_auto]">
                <label className="sr-only" htmlFor={`restaurant-recipe-ingredient-${index}`}>原料</label>
                <select id={`restaurant-recipe-ingredient-${index}`} required value={item.ingredientId} onChange={event => setRecipeDraft(current => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, ingredientId: event.target.value } : row) }))} className="min-h-10 rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm"><option value="">选择原料</option>{ingredients.map(ingredient => <option key={ingredient.id} value={ingredient.id}>{ingredient.material.name} ({ingredient.material.unit})</option>)}</select>
                <label className="sr-only" htmlFor={`restaurant-recipe-quantity-${index}`}>用量</label>
                <input id={`restaurant-recipe-quantity-${index}`} required inputMode="decimal" placeholder="用量" value={item.quantity} onChange={event => setRecipeDraft(current => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row) }))} className="min-h-10 rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                <label className="sr-only" htmlFor={`restaurant-recipe-waste-${index}`}>损耗率（0 到 1）</label>
                <input id={`restaurant-recipe-waste-${index}`} required inputMode="decimal" aria-label="损耗率（0 到 1）" placeholder="损耗率" value={item.wasteRate} onChange={event => setRecipeDraft(current => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, wasteRate: event.target.value } : row) }))} className="min-h-10 rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                <button type="button" disabled={recipeDraft.items.length <= 1} onClick={() => setRecipeDraft(current => ({ ...current, items: current.items.filter((_, rowIndex) => rowIndex !== index) }))} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm disabled:opacity-50">移除</button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRecipeDraft(current => ({ ...current, items: [...current.items, { ingredientId: '', quantity: '', wasteRate: '0' }] }))} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-semibold text-neutral-800">添加原料项</button>
              <button type="submit" disabled={busy || ingredients.length === 0} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? '保存中…' : '保存新版本'}</button>
            </div>
          </form>
        )}
        {recipes.length > 0 && (
          <ul className="divide-y divide-neutral-200">
            {recipes.map(recipe => (
              <li key={recipe.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 text-sm text-neutral-800">
                  <span className="font-semibold">配方 V{recipe.version}</span> · {recipe.status === 'active' ? '已激活' : recipe.status === 'draft' ? '草稿' : '已归档'}
                  <span className="mt-1 block text-neutral-600">{recipe.yieldQuantity} {recipe.yieldUnit} · {recipe.items.map(row => `${row.ingredientNameSnapshot} ${row.quantity}${row.unitSnapshot}`).join('、')}</span>
                </span>
                {recipe.status === 'draft' && <button type="button" disabled={busy} onClick={() => void activateRecipe(recipe)} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-semibold disabled:opacity-50">确认激活</button>}
              </li>
            ))}
          </ul>
        )}
        {costResult && (
          <p role="status" className="border-t border-neutral-200 pt-3 text-sm text-neutral-700">
            {costResult.cost.status === 'ready'
              ? `实际收货加权成本：${costResult.cost.costPerYield ?? '—'} ${costResult.cost.currency ?? ''} / 产出单位`
              : `成本状态：${costResult.cost.status}。尚无完整、同币种的实际收货成本，不能计算毛利。`}
            {costResult.menuComparison && ` · 菜单毛利：${costResult.menuComparison.status === 'ready' ? `${costResult.menuComparison.grossMargin ?? '—'} (${costResult.menuComparison.grossMarginRate ?? '—'}%)` : costResult.menuComparison.status}`}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
        <div>
          <h3 className="mb-2 text-base font-semibold text-neutral-900">菜单</h3>
          {loading ? <p role="status" className="py-4 text-sm text-neutral-600">正在读取菜单…</p> : menus.length === 0 ? (
            <p className="border-y border-neutral-200 py-6 text-sm text-neutral-600">还没有菜单。新建菜单后可加入菜品。</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {menus.map(item => (
                <li key={item.id}>
                  <button type="button" onClick={() => void loadMenu(item.id)} aria-current={menu?.id === item.id ? 'true' : undefined} className={`w-full py-3 text-left ${menu?.id === item.id ? 'text-neutral-950' : 'text-neutral-700 hover:text-neutral-950'}`}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{item.name}</span>
                      <span className="shrink-0 text-xs text-neutral-600">{item.status === 'draft' ? '草稿' : item.status === 'published' ? '已发布' : '已归档'}</span>
                    </span>
                    <span className="mt-1 block text-xs text-neutral-600">{item._count?.items ?? 0} 道菜 · {item.currency}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">{menu?.name ?? '菜单内容'}</h3>
              {menu && <p className="mt-1 text-sm text-neutral-600">{menu.currency} · {menu.status === 'draft' ? '草稿' : menu.status === 'published' ? '已发布' : '已归档'}</p>}
            </div>
            {menu && (menu.status === 'draft' || menu.status === 'published') && (
              <button type="button" onClick={() => void transitionMenu(menu.status === 'draft' ? 'publish' : 'unpublish')} disabled={busy} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-3 text-sm font-semibold text-white disabled:opacity-60">
                {menu.status === 'draft' ? '确认发布' : '撤回菜单'}
              </button>
            )}
            {menu && menu.status === 'draft' && (
              <form onSubmit={event => void addDish(event)} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="restaurant-menu-dish">选择菜品</label>
                <select id="restaurant-menu-dish" required value={itemDraft.dishId} onChange={event => setItemDraft(current => ({ ...current, dishId: event.target.value }))} className="min-h-10 max-w-48 rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm">
                  <option value="">选择菜品</option>
                  {dishes.filter(dish => dish.status !== 'archived').map(dish => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
                </select>
                <label className="sr-only" htmlFor="restaurant-menu-price">菜单售价</label>
                <input id="restaurant-menu-price" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" aria-label="菜单售价" placeholder="售价" value={itemDraft.price} onChange={event => setItemDraft(current => ({ ...current, price: event.target.value.replace(',', '.') }))} className="min-h-10 w-24 rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm placeholder:text-neutral-600" />
                <button type="submit" disabled={busy || dishes.length === 0} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-semibold text-neutral-800 disabled:opacity-50">加入菜品</button>
              </form>
            )}
          </div>
          {!menu ? (
            <p className="py-6 text-sm text-neutral-600">选择菜单查看内容，或先创建菜单草稿。</p>
          ) : menu.items?.length ? (
            <ul className="divide-y divide-neutral-200">
              {menu.items.map(item => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">{item.dish.name}</span>
                    <span className="mt-1 block text-xs text-neutral-600">{item.dish.category || '未分类'} · {item.status === 'available' ? '可售' : item.status === 'sold_out' ? '售罄' : '已隐藏'}</span>
                  </span>
                  <span className="text-sm tabular-nums text-neutral-800">{item.price} {menu.currency}</span>
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-sm text-neutral-600">此菜单还没有菜品。</p>}
        </div>
      </div>
      <p className="flex items-start gap-2 border-t border-neutral-200 pt-4 text-sm text-neutral-600">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        当前提供菜单与菜品草稿维护。正式发布需先完成有效配方及相应员工权限；收银、厨房任务和顾客下单尚未开放。
      </p>
    </section>
  );
};
