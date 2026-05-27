export type CategoryId = "hamburguesas" | "papas" | "bebidas" | "postres" | "combos";

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  tagline: string;
}

export interface Product {
  id: string;
  category: CategoryId;
  name: string;
  description: string;
  price: number;
  emoji: string;
}

export const categories: Category[] = [
  { id: "hamburguesas", name: "Hamburguesas", emoji: "🍔", tagline: "Carne 100% premium" },
  { id: "papas", name: "Papas", emoji: "🍟", tagline: "Crocantes y doradas" },
  { id: "bebidas", name: "Bebidas", emoji: "🥤", tagline: "Bien frías" },
  { id: "postres", name: "Postres", emoji: "🍰", tagline: "Dulce final" },
  { id: "combos", name: "Combos", emoji: "🍱", tagline: "El mejor precio" },
];

export const products: Product[] = [
  { id: "classic", category: "hamburguesas", name: "Classic Burger", description: "Hamburguesa simple con cheddar, lechuga y salsa especial", price: 8500, emoji: "🍔" },
  { id: "double", category: "hamburguesas", name: "Double Smash", description: "Doble carne, doble cheddar, cebolla y salsa house", price: 11500, emoji: "🍔" },
  { id: "bacon", category: "hamburguesas", name: "Bacon Burger", description: "Carne, cheddar, panceta crocante y barbacoa", price: 12500, emoji: "🥓" },
  { id: "papas-clasicas", category: "papas", name: "Papas clásicas", description: "Porción generosa, crocantes por fuera", price: 4500, emoji: "🍟" },
  { id: "papas-cheddar", category: "papas", name: "Papas con cheddar y bacon", description: "Bañadas en cheddar fundido con trozos de panceta", price: 6500, emoji: "🍟" },
  { id: "coca", category: "bebidas", name: "Coca-Cola", description: "500ml bien fría", price: 3000, emoji: "🥤" },
  { id: "agua", category: "bebidas", name: "Agua", description: "Mineral sin gas 500ml", price: 2500, emoji: "💧" },
  { id: "cerveza", category: "bebidas", name: "Cerveza artesanal", description: "Rubia tirada, pinta 473ml", price: 5000, emoji: "🍺" },
  { id: "brownie", category: "postres", name: "Brownie con helado", description: "Brownie tibio con bocha de vainilla", price: 6000, emoji: "🍰" },
  { id: "chocotorta", category: "postres", name: "Chocotorta", description: "La clásica, con dulce de leche y chocolinas", price: 5500, emoji: "🍫" },
  { id: "combo-classic", category: "combos", name: "Combo Classic", description: "Classic Burger + papas clásicas + bebida", price: 14500, emoji: "🍱" },
  { id: "combo-double", category: "combos", name: "Combo Double", description: "Double Smash + papas clásicas + bebida", price: 17500, emoji: "🍱" },
];

export const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
