import { userEvent } from 'vitest/browser';

export const createDomElement = (element = 'text') => {
  let elementToCreate = 'input';
  if (element === 'contenteditable') {
    elementToCreate = 'div';
  }
  const wrapperDiv = document.createElement('div');
  wrapperDiv.id = 'tribute-wrapper-div';
  const input = document.createElement(elementToCreate);
  input.id = `tribute-${element}`;
  wrapperDiv.appendChild(input);
  document.body.appendChild(wrapperDiv);
  return input;
};

export const clearDom = () => {
  const wrapperDivs = document.querySelectorAll('#tribute-wrapper-div');
  for (const wrapperDiv of wrapperDivs) {
    wrapperDiv.parentNode.removeChild(wrapperDiv);
  }
  const tributeContainers = document.querySelectorAll('.tribute-container');
  for (const tributeContainer of tributeContainers) {
    tributeContainer.parentNode.removeChild(tributeContainer);
  }
};

export async function fillIn(input, text) {
  input.focus();
  await userEvent.type(input, text.replaceAll('{newline}', '{Enter}'));
}

export async function press(key) {
  await userEvent.keyboard(key.length === 1 ? key : `{${key}}`);
}

export const simulateMouseClick = (targetNode) => {
  function triggerMouseEvent(targetNode, eventType) {
    const clickEvent = document.createEvent('MouseEvents');
    clickEvent.initEvent(eventType, true, true);
    targetNode.dispatchEvent(clickEvent);
  }
  for (const eventType of ['mouseover', 'mousedown', 'mouseup', 'click']) {
    triggerMouseEvent(targetNode, eventType);
  }
};

export const simulateElementScroll = (container) => {
  container.dispatchEvent(new Event('scroll'));
};
