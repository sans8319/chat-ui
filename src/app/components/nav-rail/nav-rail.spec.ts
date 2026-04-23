import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavRail } from './nav-rail';

describe('NavRail', () => {
  let component: NavRail;
  let fixture: ComponentFixture<NavRail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavRail],
    }).compileComponents();

    fixture = TestBed.createComponent(NavRail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
