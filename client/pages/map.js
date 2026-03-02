document.addEventListener('DOMContentLoaded', () => {
        const districtGrid = document.getElementById('district-grid');
        const fogOverlay = document.getElementById('fog-overlay');
        const viewer = document.getElementById('district-viewer');
        const viewerImage = document.getElementById('viewer-image');
        const viewerTitle = document.getElementById('viewer-title');
        const viewerText = document.getElementById('viewer-text');
        const closeBtn = document.getElementById('viewer-close-btn');

        // Находим все карточки
        const districtCards = districtGrid.querySelectorAll('.card');

        // Функция открытия лайтбокса
        const openViewer = (card) => {
            // Получаем контент из нажатой карточки
            const img = card.querySelector('img');
            const title = card.querySelector('h2');
            const text = card.querySelector('p');

            // Заполняем лайтбокс
            if (img) viewerImage.src = img.src;
            if (title) viewerTitle.innerHTML = title.innerHTML;
            if (text) viewerText.innerHTML = text.innerHTML;

            // Показываем лайтбокс и туман
            viewer.classList.add('is-active');
            fogOverlay.classList.add('is-active');
        };

        // Функция закрытия лайтбокса
        const closeViewer = () => {
            viewer.classList.remove('is-active');
            fogOverlay.classList.remove('is-active');

            // Очищаем контент (на всякий случай)
            viewerImage.src = "";
            viewerTitle.innerHTML = "";
            viewerText.innerHTML = "";
        };

        // Навешиваем обработчик клика на каждую карточку
        districtCards.forEach(card => {
            card.addEventListener('click', () => {
                openViewer(card);
            });
        });

        // Обработчики закрытия
        closeBtn.addEventListener('click', closeViewer);
        fogOverlay.addEventListener('click', closeViewer); // Закрытие по клику на фон
    });
