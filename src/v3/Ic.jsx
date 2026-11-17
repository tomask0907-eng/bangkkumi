// 아이콘 한 개: index.html 에 넣어 둔 아이콘 묶음(<symbol id="i-이름">)을 불러 쓴다. 크기는 className "s"(14px) 또는 "l"(22px)
export default function Ic({ name, className = '', ...rest }) {
  return (
    <svg className={`ic${className ? ` ${className}` : ''}`} aria-hidden="true" focusable="false" {...rest}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
