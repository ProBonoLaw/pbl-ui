export const invokeFormSubmit = (
  keyEvent: React.KeyboardEvent<HTMLTextAreaElement>,
) => {
  if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
    keyEvent.preventDefault();
    const element = keyEvent?.currentTarget;
    const form = element?.form;
    if (form) {
      form.requestSubmit();
    }
  }
};
