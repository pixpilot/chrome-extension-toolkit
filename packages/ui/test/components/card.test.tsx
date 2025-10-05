import { render } from '@testing-library/react';
import { Card } from '../../src/components/card';

describe('card', () => {
  it('should render children correctly', () => {
    const { getByText } = render(
      <Card>
        <p>Test Content</p>
      </Card>,
    );
    expect(getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Card className="custom-class">
        <p>Test Content</p>
      </Card>,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render title and description when provided', () => {
    const { getByText } = render(
      <Card title="Test Title" description="Test Description">
        <p>Test Content</p>
      </Card>,
    );
    expect(getByText('Test Title')).toBeInTheDocument();
    expect(getByText('Test Description')).toBeInTheDocument();
  });

  it('should not render title and description when not provided', () => {
    const { queryByText } = render(
      <Card>
        <p>Test Content</p>
      </Card>,
    );
    expect(queryByText('Test Title')).not.toBeInTheDocument();
    expect(queryByText('Test Description')).not.toBeInTheDocument();
  });
});
