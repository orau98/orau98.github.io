import ghpages from 'gh-pages';

ghpages.publish('dist', { 
  dotfiles: true,
  src: '**/*', // distディレクトリ内のすべてのファイルを対象
  dest: '.', // gh-pagesブランチのルートにデプロイ
  branch: 'gh-pages', // gh-pagesブランチにデプロイ
  remove: 'meta/plant/*.html', // 古い植物ページをすべて削除
  clean: true, // デプロイ前にgh-pagesブランチをクリーンアップ
  nojekyll: true, // .nojekyll ファイルを作成してJekyllの処理を無効化
  add: false, // 既存のファイルを完全に置き換え
  message: 'Deploying updates with clean plant pages', // デプロイ時のコミットメッセージ
  history: false // Gitの履歴を考慮せず、常に新しいコミットとしてプッシュ
}, function(err) {
  if (err) {
    console.error('Deployment error:', err);
  } else {
    console.log('Deployment complete!');
  }
});
