import type { components } from 'api-client';

export const owner: components['schemas']['Owner'] = {
  name: 'Tota Rey',
  timeZone: 'Europe/Moscow',
};

export const introCall: components['schemas']['EventType'] = {
  id: 'intro',
  title: 'Знакомство',
  description: 'Короткий звонок, чтобы познакомиться',
  durationMinutes: 15,
};

export const consultation: components['schemas']['EventType'] = {
  id: 'consultation',
  title: 'Консультация',
  description: 'Разбор вашей задачи',
  durationMinutes: 60,
};
