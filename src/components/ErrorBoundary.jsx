// 3D 보기나 DWG 모달이 깨져도 나머지 화면은 계속 쓸 수 있게 막아 준다. 앱 전체도 한 번 감싼다(main.jsx)
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) { this.props.onError?.(error); }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback ?? null;
  }
}
