// Simple local storage wrapper to simulate database persistence
// Keys: 'taller_repairs', 'inventory_items', 'equipos_list'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const storage = {
    get: async (key, initialData = []) => {
        await delay(300); // Simulate network delay
        const data = localStorage.getItem(key);
        if (!data) {
            localStorage.setItem(key, JSON.stringify(initialData));
            return initialData;
        }
        return JSON.parse(data);
    },

    set: async (key, data) => {
        await delay(300);
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    },

    // Helper to add item
    add: async (key, item) => {
        const data = await storage.get(key);
        const newItem = { ...item, id: item.id || Date.now() };
        const newData = [newItem, ...data];
        await storage.set(key, newData);
        return newItem; // Return with ID
    },

    // Helper to update item
    update: async (key, updatedItem) => {
        const data = await storage.get(key);
        const newData = data.map(item => item.id === updatedItem.id ? updatedItem : item);
        await storage.set(key, newData);
        return updatedItem;
    },

    // Helper to delete item
    remove: async (key, id) => {
        const data = await storage.get(key);
        const newData = data.filter(item => item.id !== id);
        await storage.set(key, newData);
        return id;
    }
};
