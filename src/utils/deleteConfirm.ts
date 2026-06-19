interface DeleteConfirmOptions {
  title?: string;
  targetName?: string;
  description?: string;
}

export const requestDeleteConfirmation = ({
  title = '삭제 확인',
  targetName,
  description = '이 작업은 되돌릴 수 없습니다.',
}: DeleteConfirmOptions = {}) => {
  const targetLine = targetName ? `\n대상: ${targetName}` : '';
  return window.confirm(`${title}${targetLine}\n\n정말 삭제하시겠습니까?\n${description}`);
};
