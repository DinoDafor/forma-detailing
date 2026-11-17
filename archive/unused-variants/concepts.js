const zones = {
  hood: {title:'Капот',copy:'Одна из зон риска на трассе. Прозрачная плёнка помогает снизить риск сколов от мелких камней.'},
  bumper: {title:'Передний бампер',copy:'Принимает на себя песок и мелкие камни по ходу движения. Состав и границы оклейки согласовываются после осмотра.'},
  mirrors: {title:'Корпуса зеркал',copy:'Небольшие, но открытые навстречу потоку поверхности. Плёнка помогает защитить окрашенную часть корпуса от мелких повреждений.'}
};
document.querySelectorAll('[data-zone]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.zone;
  document.querySelectorAll('[data-zone]').forEach(other => other.setAttribute('aria-pressed', String(other.dataset.zone === key)));
  document.querySelector('#zone-title').textContent = zones[key].title;
  document.querySelector('#zone-copy').textContent = zones[key].copy;
}));
const care = {
  shine: {title:'Полировка кузова',description:'Свет снова подчёркивает линии кузова. Уменьшаем мелкие следы от моек и возвращаем лаку блеск — в пределах, безопасных для покрытия.',label:'Обсудить полировку'},
  protection: {title:'Защитная плёнка',description:'Для поездок, в которых хочется меньше переживать о сколах. Подберём зоны оклейки под ваш маршрут и привычки. Возможности защиты зависят от силы воздействия.',label:'Обсудить защиту'},
  fresh: {title:'Детейлинг салона',description:'Чистый текстиль, аккуратная кожа, внимание к труднодоступным местам. Подбираем способ очистки под материалы вашего салона и даём им время высохнуть.',label:'Обсудить уход за салоном'}
};
document.querySelectorAll('[data-care]').forEach(button => button.addEventListener('click', () => {
  const selected = care[button.dataset.care];
  document.querySelectorAll('[data-care]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  document.querySelector('#care-name').textContent = selected.title;
  document.querySelector('#care-description').textContent = selected.description;
  const link = document.querySelector('#care-booking');
  link.textContent = selected.label;
  link.href = `index.html?service=${encodeURIComponent(selected.title)}#booking`;
}));
