/** Normalize vendor sheet name → stable code + display name */
export function normalizeVendor(sheetName: string): { code: string; name: string } {
  const s = sheetName.trim();
  const aliases: Record<string, string> = {
    virtl_instaspace: 'virtual_insta',
    virtual_insta: 'virtual_insta',
    virtual_instaspace: 'virtual_insta',
    namashte_office: 'namaste_office',
    namaste__office: 'namaste_office',
    'namaste_ office': 'namaste_office',
    virtual_flash_space: 'virtual_flashspace',
    virtual_flashspace: 'virtual_flashspace',
    virtual_co_hub: 'co_hub',
    co_hub: 'co_hub',
    'virtual_co hub': 'co_hub',
    redocu_signage: 'redoc_signage',
    'redocu & signage': 'redoc_signage',
    'redoc & signage': 'redoc_signage',
  };
  const key = s
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const code = aliases[key] ?? aliases[s.toLowerCase().trim()] ?? key;
  const name = s.replace(/^Virtual[_ ]?/i, '').replace(/\s+/g, ' ').trim() || s;
  return { code, name };
}
