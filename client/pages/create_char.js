const characters = [
    { id: 1, name: "Виктор", surname: "Берестов", job: "Оперативник", type: "Живчик", comment: "Склонен к насилию", url: "chars/grimm.html" },
    { id: 2, name: "Анна", surname: "Штерн", job: "Учёный ГИИБ", type: "Живчик", comment: "Ищет вакцину", url: "chars/shtern.html" },
    { id: 3, name: "Иван", surname: "Вакулов", job: "Санкционированный", type: "Голем", comment: "Гора мышц", url: "chars/vane.html" },
    { id: 4, name: "Марк", surname: "Заря", job: "Воскреситель", type: "Упырь", comment: "Работает на ГОМОН", url: "chars/drey.html" },
    { id: 5, name: "Лидия", surname: "Горбунова", job: "Подрядчик", type: "Живчик", comment: "Знает каждого попрошайку", url: "chars/nox.html" },
    { id: 6, name: "Рихтер", surname: "Вольф", job: "Торговец плотью", type: "Мертвяк", comment: "Финансирует сопротивление", url: "chars/wolf.html" }
];

let currentPage = 1;
const itemsPerPage = 5;

function renderDossiers() {
    const grid = document.getElementById('dossierGrid');
    const pageInfo = document.getElementById('pageInfo');
    if (!grid || !pageInfo) return;
    grid.innerHTML = '';
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = characters.slice(start, end);
    pageItems.forEach((char) => {
        const card = document.createElement('a');
        card.className = 'dossier-card card p-4 rounded-sm mb-4 block';
        card.href = char.url || '#';
        card.innerHTML = `<h4 class="font-title text-xl">${char.name} ${char.surname}</h4><p class="text-sm text-gray-400">${char.job} • ${char.type}</p><p class="mt-2 text-xs">${char.comment}</p>`;
        grid.appendChild(card);
        setTimeout(() => card.classList.add('active'), 50);
    });
    const totalPages = Math.max(1, Math.ceil(characters.length / itemsPerPage));
    pageInfo.innerText = `${String(currentPage).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;
}

function nextPage() {
    if (currentPage * itemsPerPage < characters.length) {
        currentPage++;
        renderDossiers();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderDossiers();
    }
}

document.addEventListener('DOMContentLoaded', renderDossiers);
