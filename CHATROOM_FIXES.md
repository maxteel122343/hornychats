# ChatRoom.tsx - Correções e Melhorias

## Resumo das Mudanças

Este documento descreve as principais correções a serem aplicadas no arquivo ChatRoom.tsx.

## 1. Quick Mode - Separar Botões de Parar e Enviar

**Problema**: Ao gravar áudio/vídeo/foto no modo rápido, o botão de "Parar" envia automaticamente sem preview.

**Solução**: No componente de gravação ativa (lines 992-1023), modificar para:

1. Adicionar estado para preview após parar gravação
2. Mostrar preview do conteúdo gravado
3. Adicionar botão "Enviar" separado do "Parar"
4. Permitir cancelar após ver preview

### Código Atual (lines 1019):
```tsx
<button onClick={stopQuickRecording} className="...">
  <StopCircle size={18} /> Parar
</button>
```

### Código Proposto:
```tsx
{!hasQuickPreview ? (
  <button onClick={stopQuickRecording} className="px-6 py-3 rounded-xl bg-red-600 text-white...">
    <StopCircle size={18} /> Parar
  </button>
) : (
  <>
    <button onClick={cancelQuickRecording} className="px-4 py-3 rounded-xl bg-slate-700...">
      Cancelar
    </button>
    <button onClick={sendQuickCapture} className="px-6 py-3 rounded-xl bg-emerald-600 text-white...">
      <Send size={18} /> Enviar
    </button>
  </>
)}
```

### Novos Estados Necessários:
```tsx
const [hasQuickPreview, setHasQuickPreview] = useState(false);
const [quickCapturedData, setQuickCapturedData] = useState<string | null>(null);
```

### Modificar stopQuickRecording:
```tsx
const stopQuickRecording = () => {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    mediaRecorderRef.current.stop();
    // NÃO chamar createQuickCard aqui!
    // Apenas parar a gravação e mostrar preview
    setHasQuickPreview(true);
  }
};
```

### Nova Função sendQuickCapture:
```tsx
const sendQuickCapture = () => {
  if (quickCapturedData && quickRecordingType) {
    const type = quickRecordingType === 'video' ? CardType.VIDEO : 
                 quickRecordingType === 'audio' ? CardType.AUDIO : CardType.IMAGE;
    create Quick Card(quickCapturedData, type);
    cleanupQuickRecording();
    setHasQuickPreview(false);
    setQuickCapturedData(null);
  }
};
```

### Modificar recorder.onstop (line 699):
```tsx
recorder.onstop = () => {
  const blob = new Blob(chunksRef.current, { type: quickRecordingType === 'video' ? 'video/webm' : 'audio/webm' });
  const url = URL.createObjectURL(blob);
  
  // Em vez de criar card imediatamente, guardar para preview
  setQuickCapturedData(url);
  setHasQuickPreview(true);
  
  // NÃO chamar createQuickCard aqui
  // createQuickCard(url, quickRecordingType === 'video' ? CardType.VIDEO : CardType.AUDIO, capturedThumbnail);
};
```

---

## 2. Correção da Função process_card_purchase

**Problema**: A venda de cards não está sendo registrada corretamente no histórico.

**Solução**: Modificar handleInteractWithCard (lines 574-603):

### Código Atual:
```tsx
await supabase.rpc('process_card_purchase', { 
  p_card_id: card.id, 
  p_buyer_id: user.id, 
  p_creator_id: cardData.creator_id, 
  p_amount: card.creditCost, 
  p_earnings: earnings 
});

// Log transaction for frontend history
await supabase.from('sales_transactions').insert([{
  seller_id: cardData.creator_id,
  buyer_id: user.id,
  buyer_name: user.name,
  card_id: card.id,
  card_title: card.title,
  amount: earnings
}]);
```

### Código Proposto:
```tsx
// A função process_card_purchase agora JÁ FAZ o insert na sales_transactions
// Remover o insert duplicado
const { data: purchaseResult, error: purchaseError } = await supabase.rpc('process_card_purchase', { 
  p_card_id: card.id, 
  p_buyer_id: user.id, 
  p_creator_id: cardData.creator_id, 
  p_amount: card.creditCost, 
  p_earnings: earnings 
});

if (purchaseError) {
  console.error('Purchase error:', purchaseError);
  alert('Erro na compra: ' + purchaseError.message);
  return false;
}

// NÃO PRECISA MAIS INSERIR MANUALMENTE
// O RPC já faz isso
```

**Importante**: A função SQL `process_card_purchase` foi atualizada no `supabase_bugfixes_schema.sql` para fazer o insert automaticamente.

---

## 3. Adicionar Card Title e Buyer Name na Transaction

**Problema**: sales_transactions não está salvando card_title e buyer_name corretamente.

**Solução**: Atualizar a função SQL para aceitar esses parâmetros:

```sql
CREATE OR REPLACE FUNCTION process_card_purchase(
  p_card_id TEXT,
  p_buyer_id UUID,
  p_creator_id UUID,
  p_amount INT,
  p_earnings INT,
  p_card_title TEXT DEFAULT '',
  p_buyer_name TEXT DEFAULT ''
)
RETURNS VOID AS $$
-- ... resto do código
INSERT INTO public.sales_transactions (
  seller_id,
  buyer_id,
  buyer_name,
  card_id,
  card_title,
  amount
) VALUES (
  p_creator_id,
  p_buyer_id,
  p_buyer_name,
  p_card_id,
  p_card_title,
  p_earnings
);
```

E chamar com:
```tsx
await supabase.rpc('process_card_purchase', { 
  p_card_id: card.id, 
  p_buyer_id: user.id, 
  p_creator_id: cardData.creator_id, 
  p_amount: card.creditCost, 
  p_earnings: earnings,
  p_card_title: card.title,
  p_buyer_name: user.name
});
```

---

## 4. Room Management - Adicionar Funcionalidades

### 4.1 Renomear Sala

Adicionar botão no header da sala (após line 869):

```tsx
{isHost && (
  <button 
    onClick={() => {
      const newName = prompt('Novo nome da sala:', sessions.find(s => s.id === roomId)?.name);
      if (newName) handleRenameRoom(roomId!, newName);
    }}
    className="p-2 hover:bg-slate-800 rounded-lg"
  >
    <Edit size={16} />
  </button>
)}
```

Implementar função:
```tsx
const handleRenameRoom = (roomId: string, newName: string) => {
  setSessions(prev => prev.map(s => 
    s.id === roomId ? {...s, name: newName} : s
  ));
  // Salvar no localStorage é automático via useEffect
};
```

### 4.2 Fechar Sala

Adicionar botão no sidebar (line 833):

```tsx
<div key={session.id} className="...group">
  {/* Conteúdo existente */}
  
  {/* Botão de fechar (aparece no hover) */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      handleCloseRoom(session.id);
    }}
    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
  >
    <X size={14} className="text-red-500" />
  </button>
</div>
```

Implementar:
```tsx
const handleCloseRoom = (roomId: string) => {
  if (confirm('Fechar esta sala?')) {
    setSessions(prev => prev.filter(s => s.id !== roomId));
    if (roomId === roomId) {
      navigate('/chat/main');
    }
  }
};
```

### 4.3 Configurações da Sala

Adicionar botão no header (após line 869):

```tsx
{isHost && (
  <button
    onClick={() => setShowRoomSettings(true)}
    className="p-2 hover:bg-slate-800 rounded-lg"
  >
    <Settings size={16} />
  </button>
)}
```

Modal de configurações (após line 1136):

```tsx
{showRoomSettings && (
  <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-black/90">
    <div className="bg-slate-900 p-8 rounded-3xl max-w-md w-full">
      <h3 className="text-xl font-black text-white mb-6">Configurações da Sala</h3>
      
      <div className="space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={roomSettings.autoCleanMessages} />
          <span className="text-sm text-white">Auto-limpar mensagens ao fechar</span>
        </label>
        
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Imagem da Sala</label>
          <button className="p-4 border-2 border-dashed border-slate-700 rounded-xl w-full">
            Upload Imagem
          </button>
        </div>
      </div>
      
      <button onClick={() => setShowRoomSettings(false)} className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl">
        Salvar
      </button>
    </div>
  </div>
)}
```

---

## 5. My Cards - Inserir em Salas

Nova aba no activeTab (line 46):

Modificar para aceitar 'my_cards' | 'chat' | 'showcase' e adicionar lógica para inserir cards em salas selecionadas.

### UI para seleção de salas (na aba my_cards):

```tsx
{activeTab === 'my_cards' && (
  <div>
    {/* Lista de cards */}
    {myCards.map(card => (
      <div key={card.id}>
        {/* Card preview */}
        <button onClick={() => setSelectedCardToInsert(card)}>
          Inserir em Salas
        </button>
      </div>
    ))}
  </div>
)}

{selectedCardToInsert && (
  <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-black/90">
    <div className="bg-slate-900 p-8 rounded-3xl max-w-md w-full">
      <h3 className="text-xl font-black text-white mb-6">Inserir em Salas</h3>
      
      <div className="space-y-2">
        {sessions.map(session => (
          <label key={session.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
            <input 
              type="checkbox" 
              checked={selectedRooms.includes(session.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedRooms(prev => [...prev, session.id]);
                } else {
                  setSelectedRooms(prev => prev.filter(id => id !== session.id));
                }
              }}
            />
            <span className="text-white text-sm">{session.name}</span>
          </label>
        ))}
      </div>
      
      <button 
        onClick={handleInsertCardIntoRooms}
        className="mt-6 w-full py-3 bg-emerald-600 text-white rounded-xl font-black"
      >
        Inserir em {selectedRooms.length} sala(s)
      </button>
    </div>
  </div>
)}
```

### Função handleInsertCardIntoRooms:

```tsx
const handleInsertCardIntoRooms = async () => {
  if (!selectedCardToInsert) return;
  
  for (const roomId of selectedRooms) {
    await supabase.from('messages').insert([{
      room_id: roomId,
      sender_id: user.id,
      sender_name: user.name,
      card_data: selectedCardToInsert
    }]);
  }
  
  setSelectedCardToInsert(null);
  setSelectedRooms([]);
  alert(`Card inserido em ${selectedRooms.length} sala(s)!`);
};
```

---

## Resumo de Estados Adicionais Necessários

```tsx
// Quick Mode Preview
const [hasQuickPreview, setHasQuickPreview] = useState(false);
const [quickCapturedData, setQuickCapturedData] = useState<string | null>(null);

// Room Management
const [showRoomSettings, setShowRoomSettings] = useState(false);
const [roomSettings, setRoomSettings] = useState({
  autoCleanMessages: false,
  imageUrl: ''
});

// Card Insertion
const [selectedCardToInsert, setSelectedCardToInsert] = useState<MediaCard | null>(null);
const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
```

---

## Aplicação das Mudanças

Execute as mudanças nesta ordem:

1. ✅ Aplicar schema SQL (`supabase_bugfixes_schema.sql`)
2. ✅ Testar com queries diagnósticas (`diagnostic_queries.sql`)
3. ⏳ Aplicar mudanças no `CardModal.tsx` (já feito)
4. ⏳ Aplicar mudanças no `ChatRoom.tsx` (este documento)
5. ⏳ Testar todas as funcionalidades

