import re

with open('frontend/src/pages/RecycleBin.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

correct_block = """  const fetchRecords = useCallback(async (tab = activeTab, page = 1, search = searchTerm) => {
    try {
      setLoading(true);
      const data = await getRecycleBinRecords(tab, page, pagination.pageSize, search);
      setRecords(data.records);
      setPagination({
        page: data.page,
        totalPages: data.total_pages,
        total: data.total,
        pageSize: data.page_size
      });
    } catch (error) {
      console.error('Error fetching recycle bin records:', error);
      showToast('Failed to load recycle bin records', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, pagination.pageSize, searchTerm, showToast]);

  useEffect(() => {
    fetchRecords(activeTab, 1, searchTerm);
  }, [activeTab, fetchRecords]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords(activeTab, 1, searchTerm);
  };

  const handleRestore = async (id, name) => {
    showConfirm({
      title: 'Restore Record',
      message: `Are you sure you want to restore "${name}"?`,
      confirmText: 'Restore',
      type: 'info',
      onConfirm: async () => {
        try {
          await restoreRecord(activeTab, id);
          showToast(`${name} restored successfully`, 'success');
          fetchRecords();
        } catch (error) {
          console.error('Error restoring record:', error);
          showToast(error?.response?.data?.detail || 'Failed to restore record', 'error');
        }
      }
    });
  };

  const handlePermanentDelete = async (id, name) => {
    showConfirm({
      title: 'Delete Forever',
      message: `WARNING: This action cannot be undone. Are you sure you want to permanently delete "${name}"?`,
      confirmText: 'Delete Permanently',
      type: 'danger',
      onConfirm: async () => {
        try {
          await permanentDeleteRecord(activeTab, id);
          showToast(`${name} permanently deleted`, 'success');
          fetchRecords();
        } catch (error) {
          console.error('Error deleting record permanently:', error);
          showToast(error?.response?.data?.detail || 'Failed to delete record permanently', 'error');
        }
      }
    });
  };

  const handleEmptyBin = async () => {
    if (records.length === 0) return;
    showConfirm({
      title: 'Empty Recycle Bin Page',
      message: `Are you sure you want to permanently delete all ${records.length} records on this page? This action cannot be undone.`,
      confirmText: 'Empty Bin',
      type: 'danger',
      onConfirm: async () => {
        setIsEmptying(true);
        let successCount = 0;
        for (const record of records) {
          try {
            await permanentDeleteRecord(activeTab, record.id);
            successCount++;
          } catch (e) {
            console.error(e);
          }
        }
        setIsEmptying(false);
        showToast(`Permanently deleted ${successCount} records.`, 'success');
        fetchRecords();
      }
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return ("""

start_idx = content.find('  const fetchRecords = useCallback(')
end_idx = content.find('      <div className="eu-recycle-date">')

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + correct_block + '\n' + content[end_idx:]
    with open('frontend/src/pages/RecycleBin.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("FAILED TO FIND INDEXES", start_idx, end_idx)
