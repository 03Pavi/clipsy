import { Box, List, Typography } from '@mui/material';
import { ClipboardItem as ClipboardItemType } from '../../types/clipboard.types';
import ClipboardItem from './clipboard-item';

export default function ClipboardList({ items, loading }: { items: ClipboardItemType[], loading: boolean }) {
  if (loading && items.length === 0) {
    return <Typography sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', mt: 4 }}>Loading history...</Typography>;
  }

  if (items.length === 0) {
    return (
      <Box textAlign="center" py={8} sx={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 4, mt: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Clipboard is empty. Paste something to sync!</Typography>
      </Box>
    );
  }

  return (
    <List sx={{ px: 0 }}>
      {items.map((item) => (
        <ClipboardItem key={item.id} item={item} />
      ))}
    </List>
  );
}
