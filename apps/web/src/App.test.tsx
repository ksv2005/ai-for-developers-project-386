import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  afterEach(cleanup)

  it('renders the page heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Календарь звонков' }),
    ).toBeTruthy()
  })
})
