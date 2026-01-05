// Основные переменные
let currentUser = null;
let currentChat = null;
let chats = [];
let contacts = [];
let groups = [];
let channels = [];
let allUsers = [];

// Инициализация приложения
async function initApp() {
    try {
        // Проверяем авторизацию
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                await loadUserData();
                await loadContacts();
                await loadChats();
                await loadGroups();
                await loadChannels();
                updateUserInterface();
                setupRealTimeListeners();
            } else {
                window.location.href = 'index.html';
            }
        });
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
}

// Загрузка данных пользователя
async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('user-name').textContent = userData.displayName || userData.fullname;
            document.getElementById('user-status-text').textContent = userData.status || 'онлайн';
            
            if (userData.avatar) {
                const avatarEl = document.getElementById('user-avatar');
                avatarEl.innerHTML = `<img src="${userData.avatar}" alt="${userData.displayName}">`;
            }
            
            // Обновляем статус на "онлайн"
            await db.collection('users').doc(currentUser.uid).update({
                isOnline: true,
                lastSeen: new Date().toISOString(),
                status: 'online'
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
    }
}

// Загрузка контактов
async function loadContacts() {
    try {
        const snapshot = await db.collection('users')
            .where('phone', '!=', '')
            .limit(50)
            .get();
        
        contacts = [];
        snapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                const user = doc.data();
                user.uid = doc.id;
                contacts.push(user);
            }
        });
        
        allUsers = [...contacts];
        renderContactsList();
    } catch (error) {
        console.error('Ошибка загрузки контактов:', error);
    }
}

// Загрузка чатов
async function loadChats() {
    try {
        const snapshot = await db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .where('type', '==', 'private')
            .orderBy('lastMessageTime', 'desc')
            .limit(20)
            .get();
        
        chats = [];
        snapshot.forEach(doc => {
            const chat = doc.data();
            chat.id = doc.id;
            chats.push(chat);
        });
        
        renderChatsList();
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
    }
}

// Загрузка групп
async function loadGroups() {
    try {
        const snapshot = await db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .where('type', '==', 'group')
            .orderBy('lastMessageTime', 'desc')
            .limit(20)
            .get();
        
        groups = [];
        snapshot.forEach(doc => {
            const group = doc.data();
            group.id = doc.id;
            groups.push(group);
        });
        
        renderGroupsList();
    } catch (error) {
        console.error('Ошибка загрузки групп:', error);
    }
}

// Загрузка каналов
async function loadChannels() {
    try {
        const snapshot = await db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .where('type', '==', 'channel')
            .orderBy('lastMessageTime', 'desc')
            .limit(20)
            .get();
        
        channels = [];
        snapshot.forEach(doc => {
            const channel = doc.data();
            channel.id = doc.id;
            channels.push(channel);
        });
        
        renderChannelsList();
    } catch (error) {
        console.error('Ошибка загрузки каналов:', error);
    }
}

// Рендеринг списка чатов
function renderChatsList() {
    const container = document.getElementById('chats-list');
    container.innerHTML = '';
    
    if (chats.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Нет чатов</div>';
        return;
    }
    
    chats.forEach(chat => {
        const participantId = chat.participants.find(id => id !== currentUser.uid);
        const contact = contacts.find(c => c.uid === participantId) || {};
        
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${currentChat?.id === chat.id ? 'active' : ''}`;
        chatItem.onclick = () => openChat(chat);
        
        chatItem.innerHTML = `
            <div class="item-avatar">
                <div class="avatar-icon" style="background: ${getColorFromName(contact.displayName || '?')}">
                    ${(contact.displayName || '?').charAt(0).toUpperCase()}
                </div>
                <div class="online-status ${contact.isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="item-info">
                <div class="item-header">
                    <div class="item-name">${contact.displayName || contact.phone || 'Неизвестный'}</div>
                    <div class="item-time">${formatTime(chat.lastMessageTime)}</div>
                </div>
                <div class="item-preview">${chat.lastMessage || 'Нет сообщений'}</div>
            </div>
            ${chat.unreadCount > 0 ? `<div class="unread-count">${chat.unreadCount}</div>` : ''}
        `;
        
        container.appendChild(chatItem);
    });
}

// Рендеринг списка контактов
function renderContactsList() {
    const container = document.getElementById('contacts-list');
    container.innerHTML = '';
    
    contacts.forEach(contact => {
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.onclick = () => openPrivateChat(contact.uid);
        
        contactItem.innerHTML = `
            <div class="item-avatar">
                <div class="avatar-icon" style="background: ${getColorFromName(contact.displayName)}">
                    ${contact.displayName.charAt(0).toUpperCase()}
                </div>
                <div class="online-status ${contact.isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="item-info">
                <div class="item-header">
                    <div class="item-name">${contact.displayName}</div>
                </div>
                <div class="item-preview">${contact.phone}</div>
            </div>
        `;
        
        container.appendChild(contactItem);
    });
}

// Открытие приватного чата
async function openPrivateChat(userId) {
    try {
        // Ищем существующий чат
        let chat = chats.find(c => 
            c.participants.includes(userId) && 
            c.participants.includes(currentUser.uid) &&
            c.type === 'private'
        );
        
        if (!chat) {
            // Создаем новый чат
            const chatData = {
                type: 'private',
                participants: [currentUser.uid, userId],
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '',
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                unreadCount: 0,
                messages: []
            };
            
            const docRef = await db.collection('chats').add(chatData);
            chat = { ...chatData, id: docRef.id };
            chats.unshift(chat);
        }
        
        openChat(chat);
        hideModal('new-chat-modal');
    } catch (error) {
        console.error('Ошибка открытия чата:', error);
        alert('Ошибка открытия чата: ' + error.message);
    }
}

// Открытие чата
async function openChat(chat) {
    currentChat = chat;
    
    // Обновляем интерфейс
    document.getElementById('chat-title').textContent = chat.name || 
        getChatName(chat);
    document.getElementById('chat-members').textContent = 
        chat.type === 'private' ? 'личные сообщения' :
        chat.type === 'group' ? `${chat.participants?.length || 0} участников` :
        chat.type === 'channel' ? 'канал' : 'чат';
    
    // Загружаем сообщения
    await loadMessages(chat.id);
    
    // Обновляем списки
    renderChatsList();
    renderGroupsList();
    renderChannelsList();
    
    // Помечаем как прочитанное
    if (chat.unreadCount > 0) {
        await db.collection('chats').doc(chat.id).update({
            unreadCount: 0
        });
    }
}

// Загрузка сообщений
async function loadMessages(chatId) {
    try {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '<div class="message-date"><span>Сегодня</span></div>';
        
        const snapshot = await db.collection('chats').doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .limit(100)
            .get();
        
        let lastDate = null;
        
        snapshot.forEach(doc => {
            const message = doc.data();
            message.id = doc.id;
            
            // Проверяем смену даты
            const messageDate = new Date(message.timestamp?.toDate());
            const today = new Date();
            const isToday = messageDate.toDateString() === today.toDateString();
            
            if (!lastDate || messageDate.toDateString() !== lastDate.toDateString()) {
                const dateDiv = document.createElement('div');
                dateDiv.className = 'message-date';
                dateDiv.innerHTML = `<span>${isToday ? 'Сегодня' : messageDate.toLocaleDateString('ru-RU')}</span>`;
                messagesContainer.appendChild(dateDiv);
            }
            lastDate = messageDate;
            
            // Создаем элемент сообщения
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.senderId === currentUser.uid ? 'message-outgoing' : 'message-incoming'}`;
            
            let senderName = 'Вы';
            if (message.senderId !== currentUser.uid) {
                const sender = contacts.find(c => c.uid === message.senderId);
                senderName = sender?.displayName || 'Неизвестный';
            }
            
            messageDiv.innerHTML = `
                ${message.senderId !== currentUser.uid ? `<div class="message-sender">${senderName}</div>` : ''}
                <div class="message-text">${message.text}</div>
                <div class="message-time">${message.timestamp?.toDate().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            
            messagesContainer.appendChild(messageDiv);
        });
        
        // Прокручиваем вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
}

// Отправка сообщения
async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text || !currentChat) {
        return;
    }
    
    try {
        // Создаем сообщение
        const message = {
            text: text,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'text',
            chatId: currentChat.id
        };
        
        // Добавляем в подколлекцию messages
        await db.collection('chats').doc(currentChat.id)
            .collection('messages').add(message);
        
        // Обновляем информацию о чате
        await db.collection('chats').doc(currentChat.id).update({
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageSender: currentUser.uid
        });
        
        // Обновляем счетчик непрочитанных для других участников
        currentChat.participants.forEach(async (participantId) => {
            if (participantId !== currentUser.uid) {
                await db.collection('chats').doc(currentChat.id).update({
                    unreadCount: firebase.firestore.FieldValue.increment(1)
                });
            }
        });
        
        // Очищаем поле ввода
        input.value = '';
        
        // Перезагружаем сообщения
        await loadMessages(currentChat.id);
        
        // Обновляем списки
        await loadChats();
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        alert('Ошибка отправки сообщения: ' + error.message);
    }
}

// Создание нового чата
async function createNewChat() {
    const type = document.getElementById('chat-type-select').value;
    
    try {
        if (type === 'private') {
            // Личный чат уже обрабатывается в openPrivateChat
            return;
            
        } else if (type === 'group') {
            const name = document.getElementById('group-name-input').value.trim();
            const description = document.getElementById('group-description-input').value.trim();
            
            if (!name) {
                alert('Введите название группы');
                return;
            }
            
            // Создаем группу
            const groupData = {
                type: 'group',
                name: name,
                description: description,
                participants: [currentUser.uid],
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '',
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                unreadCount: 0,
                messages: [],
                admins: [currentUser.uid]
            };
            
            const docRef = await db.collection('chats').add(groupData);
            const group = { ...groupData, id: docRef.id };
            groups.unshift(group);
            
            openChat(group);
            
        } else if (type === 'channel') {
            const name = document.getElementById('channel-name-input').value.trim();
            const description = document.getElementById('channel-description-input').value.trim();
            const link = document.getElementById('channel-link-input').value.trim();
            
            if (!name) {
                alert('Введите название канала');
                return;
            }
            
            // Создаем канал
            const channelData = {
                type: 'channel',
                name: name,
                description: description,
                link: link,
                participants: [currentUser.uid],
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '',
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                unreadCount: 0,
                messages: [],
                subscribers: [currentUser.uid]
            };
            
            const docRef = await db.collection('chats').add(channelData);
            const channel = { ...channelData, id: docRef.id };
            channels.unshift(channel);
            
            openChat(channel);
        }
        
        hideModal('new-chat-modal');
        resetModalFields();
        
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        alert('Ошибка создания чата: ' + error.message);
    }
}

// Поиск пользователей
async function searchUsers() {
    const query = document.getElementById('search-user-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');
    
    if (!query) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    try {
        // Ищем по username
        const usernameSnapshot = await db.collection('users')
            .where('username', '>=', query)
            .where('username', '<=', query + '\uf8ff')
            .limit(10)
            .get();
        
        // Ищем по номеру телефона
        const phoneSnapshot = await db.collection('users')
            .where('phone', '>=', query)
            .where('phone', '<=', query + '\uf8ff')
            .limit(10)
            .get();
        
        const results = new Map();
        
        usernameSnapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                results.set(doc.id, doc.data());
            }
        });
        
        phoneSnapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                results.set(doc.id, doc.data());
            }
        });
        
        resultsContainer.innerHTML = '';
        
        if (results.size === 0) {
            resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Пользователи не найдены</div>';
            return;
        }
        
        results.forEach((user, uid) => {
            const userItem = document.createElement('div');
            userItem.className = 'user-select-item';
            userItem.onclick = () => openPrivateChat(uid);
            
            userItem.innerHTML = `
                <div class="user-select-info">
                    <div class="avatar-icon" style="width: 40px; height: 40px; background: ${getColorFromName(user.displayName)}">
                        ${user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${user.displayName}</div>
                        <div style="font-size: 12px; color: #666;">${user.phone}</div>
                        <div style="font-size: 12px; color: #999;">@${user.username}</div>
                    </div>
                </div>
            `;
            
            resultsContainer.appendChild(userItem);
        });
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

// Утилиты
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
    } else {
        return date.toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'});
    }
}

function getColorFromName(name) {
    const colors = ['#0088cc', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4'];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
}

function getChatName(chat) {
    if (chat.name) return chat.name;
    
    if (chat.type === 'private') {
        const participantId = chat.participants.find(id => id !== currentUser.uid);
        const contact = contacts.find(c => c.uid === participantId);
        return contact?.displayName || 'Неизвестный';
    }
    
    return 'Без названия';
}

function showList(listName) {
    document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.list').forEach(list => list.classList.remove('active'));
    
    event.target.classList.add('active');
    document.get
