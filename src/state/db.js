import { get, set, del } from 'idb-keyval';

const DB_PROJECT_KEY = 'geocanvas_project_data';

export async function saveProjectToDB(projectData) {
  try {
    const payload = {
      pdfArrayBuffer: projectData.pdfArrayBuffer || null,
      pdfFileName: projectData.pdfFileName || 'Document.pdf',
      totalPages: projectData.totalPages || 1,
      currentPage: projectData.currentPage || 1,
      pages: projectData.pages || {},
      pageDimensions: projectData.pageDimensions || { width: 595.28, height: 841.89 },
      settings: projectData.settings || {},
      savedAt: Date.now()
    };
    await set(DB_PROJECT_KEY, payload);
    return { success: true };
  } catch (err) {
    console.error('Error saving project to IndexedDB:', err);
    return { success: false, error: err.message };
  }
}

export async function loadProjectFromDB() {
  try {
    const data = await get(DB_PROJECT_KEY);
    return data || null;
  } catch (err) {
    console.error('Error loading project from IndexedDB:', err);
    return null;
  }
}

export async function clearProjectFromDB() {
  try {
    await del(DB_PROJECT_KEY);
    return true;
  } catch (err) {
    console.error('Error clearing project from IndexedDB:', err);
    return false;
  }
}
