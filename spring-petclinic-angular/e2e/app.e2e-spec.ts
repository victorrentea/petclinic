import { SpringPetclinicAngularPage } from './app.po';

describe('spring-petclinic-angular App', () => {
  let page: SpringPetclinicAngularPage;

  beforeEach(() => {
    page = new SpringPetclinicAngularPage();
  });

  it('should display app works message', done => {
    page.navigateTo();
    // page.getParagraphText()
    //   .then(msg => expect(msg).toEqual('app works!'))
    //   .then(done, done.fail);
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
